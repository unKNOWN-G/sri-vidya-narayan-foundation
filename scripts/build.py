#!/usr/bin/env python3
"""Build the deployable static site from reviewed source, content and assets."""
from __future__ import annotations

import argparse
import hashlib
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
