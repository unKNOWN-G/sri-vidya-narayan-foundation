#!/usr/bin/env python3
"""Build the deployable static site from reviewed source, content and assets."""
from __future__ import annotations

import argparse
import hashlib
from html import escape
import json
from pathlib import Path
import re
import shutil
import sys
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

from validate import ROOT, validate


def build(destination=None, skip_validation=False):
    output = (destination or ROOT / "dist").resolve()
    if output == ROOT or not output.is_relative_to(ROOT):
        raise ValueError("Build output must be a subdirectory of this project.")
    if any(output == ROOT / name or output.is_relative_to(ROOT / name) for name in ("src", "content", "assets", "media", "docs", "scripts", ".git")):
        raise ValueError("Build output cannot replace a source or archive directory.")
    if not skip_validation:
        errors, warnings, _ = validate()
        for warning in warnings:
            print(f"WARNING: {warning}")
        if errors:
            raise ValueError("Source validation failed:\n" + "\n".join(errors))
    marker = output / ".generated-site"
    if output.exists():
        if output != ROOT / "dist" and not marker.is_file() and any(output.iterdir()):
            raise ValueError("Refusing to replace a nonempty unmarked custom output directory.")
        shutil.rmtree(output)
    output.mkdir(parents=True)
    ignored = shutil.ignore_patterns(".DS_Store", "Thumbs.db", "__pycache__", ".env", ".env.*")
    shutil.copytree(ROOT / "src", output, dirs_exist_ok=True, ignore=ignored)
    for folder in ("content", "assets"):
        source = ROOT / folder
        if source.exists():
            shutil.copytree(source, output / folder, ignore=ignored)
    manifest_path = output / "content" / "site.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    directories = manifest.pop("contentDirectories", {})
    for name in ("categories", "events"):
        if name not in directories:
            continue
        folder = (output / "content" / directories[name]).resolve()
        if not folder.is_relative_to(output / "content") or not folder.is_dir():
            raise ValueError(f"Invalid canonical content directory: {name}")
        records = []
        for path in sorted(folder.glob("*.json")):
            record = json.loads(path.read_text(encoding="utf-8"))
            if name == "events" and record.get("published") is False:
                path.unlink()  # Remove only the generated copy, never the source draft.
                continue
            records.append(record)
        explicit_order = {identifier: index for index, identifier in enumerate(manifest.get("categoryOrder" if name == "categories" else "eventOrder", []))}
        def order(record):
            value = record.get("order", 1000000)
            return (explicit_order.get(record.get("id"), len(explicit_order)), value if isinstance(value, (int, float)) else 1000000, str(record.get("id", "")))
        manifest[name] = sorted(records, key=order)
    total_categories = [c for c in manifest["categories"] if c.get("homeContributionCategory")]
    if total_categories:
        ledger = json.loads((output / manifest["collections"]["contributions"]).read_text(encoding="utf-8"))
        records = ledger.get("records", [])
        if len({r["id"] for r in records}) != len(records):
            raise ValueError("Duplicate contribution IDs would inflate homepage totals.")
        for category in total_categories:
            selected = [r for r in records if r.get("category") == category["homeContributionCategory"]]
            if selected:
                category["homeContributionTotal"] = {
                    "amount": sum(r["amount"] for r in selected),
                    "approximate": any(r.get("approximate") or r.get("reported") for r in selected),
                }
    variants = output / "content" / "image-variants.json"
    if variants.is_file():
        manifest["imageVariants"] = json.loads(variants.read_text(encoding="utf-8"))
    # Static social previews give individual stories a meaningful share card.
    # The browser redirects to the same SPA route; no content is duplicated manually.
    public_base = "https://unknown-g.github.io/sri-vidya-narayan-foundation/"
    shares = {}
    def share_page(kind, identifier, title, description, image, route):
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", identifier):
            raise ValueError("Invalid share page identifier.")
        relative = f"visit/{kind}/{identifier}.html"
        target = "../../index.html" + route
        canonical = public_base + relative
        image_url = public_base + (image or "assets/media/his-holiness/portrait-and-journey/foundation-5.webp")
        page = output / relative
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} — Sri Vidya Narayan Foundation</title><meta name="description" content="{escape(description, quote=True)}"><meta property="og:type" content="website"><meta property="og:title" content="{escape(title, quote=True)}"><meta property="og:description" content="{escape(description, quote=True)}"><meta property="og:image" content="{escape(image_url, quote=True)}"><meta property="og:url" content="{escape(canonical, quote=True)}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="{escape(canonical, quote=True)}"><meta http-equiv="refresh" content="0;url={escape(target, quote=True)}"></head><body><main><h1>{escape(title)}</h1><p>{escape(description)}</p><a href="{escape(target, quote=True)}">Open this story</a></main></body></html>''', encoding="utf-8")
        shares[route] = relative
    for category in manifest.get("categories", []):
        if category.get("published") is not False:
            route = "#/learn" if category["id"] == "teachings" else "#/category/" + category["id"]
            share_page("category", category["id"], category.get("title", category["id"]), category.get("caption", ""), category.get("cover"), route)
    for event in manifest.get("events", []):
        share_page("event", event["id"], event["title"], event.get("intro") or event.get("description", ""), event.get("cover"), "#/event/" + event["id"])
    profiles_path = output / "content" / "collections" / "education-profiles.json"
    profiles = json.loads(profiles_path.read_text(encoding="utf-8")) if profiles_path.is_file() else []
    events_by_id = {event["id"]: event for event in manifest.get("events", [])}
    for profile in profiles:
        image = profile.get("cover") or events_by_id.get(profile.get("eventId"), {}).get("cover")
        share_page("school", profile["id"], profile["title"], profile.get("description", ""), image, "#/category/education/schools/" + profile["id"])
    ledger_path = output / "content" / "collections" / "contributions.json"
    if ledger_path.is_file():
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
        for record in ledger.get("records", []):
            profile = next((p for p in profiles if record["id"] in p.get("recordIds", [])), {})
            event = events_by_id.get(profile.get("eventId")) or next((e for e in manifest.get("events", []) if record["id"] in e.get("supportRecordIds", [])), {})
            image = profile.get("cover") or event.get("cover")
            share_page("support", record["id"], record.get("recipient", "Historical support"), record.get("summary") or "Service through generosity.", image, "#/record/" + record["id"])
        for group in ledger.get("displayGroups", []):
            event = next((e for e in manifest.get("events", []) if e.get("supportGroupId") == group["id"]), {})
            share_page("support", group["id"], group["title"], group.get("summary", ""), event.get("cover"), "#/record/" + group["id"])
    readings_path = output / "content" / "collections" / "readings.json"
    if readings_path.is_file():
        readings = json.loads(readings_path.read_text(encoding="utf-8")).get("readings", [])
        for reading in readings:
            share_page("reading", reading["id"], reading["title"], reading.get("lead", ""), None, "#/read/readings/" + reading["id"])
    for identifier, title in (("readings", "Satsangs"), ("books", "Spiritual books"), ("teachings", "Everyday teachings")):
        share_page("library", identifier, title, "Teachings of Sri Vidyanarayana Thirtha Swamiji: read, reflect and carry them into daily life.", None, "#/library/" + identifier)
    share_page("foundation", "about", "Sri Vidya Narayan Foundation", manifest.get("foundation", {}).get("description", "A tribute through service."), None, "#/foundation")
    manifest["sharePages"] = shares
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Separate readers use synchronous globals, generated from canonical JSON.
    # Source JS stubs document this boundary and never duplicate editorial data.
    for filename, source_name, variable, field in (
        ("event-cards-data.js", "cards.json", "foundationEventCards", None),
        ("pearls-data.js", "pearls.json", "pearlsOfWisdom", "entries"),
    ):
        source = output / "content" / "collections" / source_name
        if not source.is_file():
            if (output / filename).is_file():
                raise ValueError(f"Missing canonical reader content: {source_name}")
            continue
        data = json.loads(source.read_text(encoding="utf-8"))
        if field:
            data = data.get(field) if isinstance(data, dict) else None
        if not isinstance(data, list) or not data:
            raise ValueError(f"Canonical reader content must be a nonempty array: {source_name}")
        payload = json.dumps(data, ensure_ascii=False, indent=2)
        (output / filename).write_text(f"// Generated from content/collections/{source_name}; do not edit.\nwindow.{variable} = {payload};\n", encoding="utf-8")

    versions = {path: hashlib.sha256(path.read_bytes()).hexdigest()[:12]
                for path in output.rglob("*") if path.suffix.lower() in (".css", ".js") and path.is_file()}
    for page in output.rglob("*.html"):
        text = page.read_text(encoding="utf-8")
        def version_reference(match):
            parsed = urlsplit(match.group(2))
            if parsed.scheme or parsed.netloc or not parsed.path:
                return match.group(0)
            target = ((output if parsed.path.startswith("/") else page.parent) / unquote(parsed.path.lstrip("/"))).resolve()
            if target not in versions:
                return match.group(0)
            query = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if key != "v"]
            query.append(("v", versions[target]))
            url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))
            return match.group(1) + url + match.group(3)
        text = re.sub(r"((?:src|href)\s*=\s*[\"'])([^\"']+)([\"'])", version_reference, text, flags=re.IGNORECASE)
        page.write_text(text, encoding="utf-8")
    (output / ".nojekyll").touch()
    marker.write_text("Generated by scripts/build.py. Edit src/, content/ and assets/, then rebuild.\n", encoding="utf-8")
    if not skip_validation:
        errors, warnings, _ = validate(dist=output)
        for warning in warnings:
            print(f"WARNING: {warning}")
        if errors:
            raise ValueError("Built-site validation failed:\n" + "\n".join(errors))
    files = sum(path.is_file() for path in output.rglob("*"))
    print(f"Built {files} files in {output.relative_to(ROOT)}/")
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, help="Generated output subdirectory (default: dist).")
    parser.add_argument("--skip-validation", action="store_true", help="Diagnostic use only; normal builds validate source and output.")
    args = parser.parse_args()
    try:
        destination = args.out if args.out is None or args.out.is_absolute() else ROOT / args.out
        build(destination, args.skip_validation)
    except (ValueError, OSError) as exc:
        print(f"Build failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
