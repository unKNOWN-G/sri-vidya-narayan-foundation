#!/usr/bin/env python3
"""Validate source and built public references without third-party packages."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
TEXT_EXTENSIONS = {".html", ".css", ".js", ".json", ".txt", ".md", ".svg"}
LOCAL_PATH = re.compile(r"(?:/Users/|/home/|file://|[A-Za-z]:\\Users\\)")
CSS_URL = re.compile(r"url\(\s*['\"]?([^)'\"\s]+)")
LITERAL_ASSET = re.compile(r"['\"]((?:\./)?assets/[^'\"\n]+)['\"]")


class Markup(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references = []
        self.ids = set()
        self.missing_alt = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "img" and "alt" not in attrs:
            self.missing_alt += 1
        for attribute in ("src", "href", "poster"):
            if attrs.get(attribute):
                self.references.append(attrs[attribute])
        if attrs.get("srcset"):
            self.references.extend(part.strip().split()[0] for part in attrs["srcset"].split(",") if part.strip())


def markup(path):
    parsed = Markup()
    parsed.feed(path.read_text(encoding="utf-8"))
    return parsed


def public_target(reference, current, public_root, source=False):
    """Resolve deployment-relative URLs against source or generated layout."""
    value = reference.strip()
    parsed = urlsplit(value)
    if not value or parsed.scheme or parsed.netloc or value.startswith("data:"):
        return None, ""
    route = unquote(parsed.path)
    if not route:
        return current, unquote(parsed.fragment)
    if source:
        clean = route.lstrip("./")
        if clean.startswith(("assets/", "content/")):
            target = ROOT / clean
        elif route.startswith("/"):
            target = ROOT / "src" / route.lstrip("/")
        else:
            target = current.parent / route
    else:
        target = public_root / route.lstrip("/") if route.startswith("/") else current.parent / route
    target = target.resolve()
    if target.is_dir():
        target /= "index.html"
    return target, unquote(parsed.fragment)


def walk_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from walk_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk_strings(item)


def validate(dist=None):
    errors, warnings = [], []
    source = dist is None
    public = ROOT / "src" if source else Path(dist).resolve()
    content_dir = ROOT / "content" if source else public / "content"
    assets_dir = ROOT / "assets" if source else public / "assets"
    required = [public / "index.html", public / "styles.css", public / "app.js", content_dir / "site.json"]
    for path in required:
        if not path.is_file():
            errors.append(f"Missing required file: {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}")
    json_count = 0
    for path in sorted(content_dir.rglob("*.json")) if content_dir.exists() else []:
        json_count += 1
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, UnicodeError) as exc:
            errors.append(f"Invalid JSON: {path.name}: {exc}")
            continue
        if not source and path.parent.name == "events" and isinstance(data, dict) and data.get("published") is False:
            errors.append(f"Unpublished event appeared in public build: {path.name}")
        if path.name == "site.json" and path.parent == content_dir:
            directories = data.get("contentDirectories", {}) if isinstance(data, dict) else {}
            has_categories = isinstance(data, dict) and isinstance(data.get("categories"), (list, dict)) and bool(data["categories"])
            if not has_categories and not (source and directories.get("categories")):
                errors.append("content/site.json needs categories or a canonical categories directory.")
            for name, relative in directories.items():
                if name not in ("categories", "events") or not isinstance(relative, str):
                    errors.append(f"Unsupported canonical content directory: {name}")
                    continue
                directory = (content_dir / relative).resolve()
                if not directory.is_relative_to(content_dir.resolve()) or not directory.is_dir():
                    errors.append(f"Missing or unsafe canonical directory: {relative}")
                    continue
                records = sorted(directory.glob("*.json"))
                if name == "categories" and not records:
                    errors.append("Canonical categories directory is empty.")
                identifiers = set()
                for record in records:
                    try:
                        value = json.loads(record.read_text(encoding="utf-8"))
                        identifier = value.get("id") if isinstance(value, dict) else None
                        if not isinstance(identifier, str) or not identifier:
                            errors.append(f"Canonical record needs an id: {record.name}")
                        elif identifier in identifiers:
                            errors.append(f"Duplicate {name} id: {identifier}")
                        identifiers.add(identifier)
                    except (ValueError, UnicodeError):
                        pass  # The normal content JSON pass reports the parse error.
        for value in walk_strings(data):
            if LOCAL_PATH.search(value):
                errors.append(f"Local source path in public JSON: {path.name}")
            if re.match(r"^(?:\./)?assets/", value):
                asset = (ROOT if source else public) / unquote(urlsplit(value).path).removeprefix("./")
                if not asset.is_file():
                    errors.append(f"Missing content asset: {value}")

    html_paths = list(public.rglob("*.html")) if public.exists() else []
    # src/ should contain website files only. assets/content are checked separately.
    for path in html_paths:
        try:
            parsed = markup(path)
        except UnicodeError as exc:
            errors.append(f"Unreadable HTML: {path.name}: {exc}")
            continue
        if parsed.missing_alt:
            errors.append(f"{path.name}: {parsed.missing_alt} image(s) missing an alt attribute.")
        for reference in parsed.references:
            try:
                target, fragment = public_target(reference, path, public, source)
            except ValueError:
                errors.append(f"Invalid URL in {path.name}: {reference}")
                continue
            if target is None:
                continue
            if not target.is_file():
                errors.append(f"Missing reference from {path.name}: {reference}")
            elif fragment and target.suffix == ".html" and not any(c in fragment for c in "/=!?&"):
                if fragment not in markup(target).ids:
                    errors.append(f"Missing anchor from {path.name}: {reference}")

    for path in list(public.rglob("*.css")) + list(public.rglob("*.js")) if public.exists() else []:
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeError:
            continue
        references = CSS_URL.findall(text) if path.suffix == ".css" else LITERAL_ASSET.findall(text)
        for reference in references:
            if any(c in reference for c in ("${", "<", ">")):
                continue
            target, _ = public_target(reference, path, public, source)
            if target is not None and not target.is_file():
                errors.append(f"Missing reference from {path.name}: {reference}")

    for path in assets_dir.rglob("*") if assets_dir.exists() else []:
        if path.is_symlink():
            errors.append(f"Public asset is a symlink; copy a portable file instead: {path.relative_to(assets_dir)}")
        elif path.is_file() and path.stat().st_size > 90 * 1024 * 1024:
            warnings.append(f"Large public asset (>90 MiB): {path.relative_to(assets_dir)}")
    if not source:
        for path in public.rglob("*"):
            if path.is_file() and path.suffix.lower() in TEXT_EXTENSIONS:
                try:
                    if LOCAL_PATH.search(path.read_text(encoding="utf-8")):
                        errors.append(f"Local source path in built public file: {path.relative_to(public)}")
                except UnicodeError:
                    pass
        for excluded in ("media/catalog.json", "private", "incoming", ".git", "PROJECT.json"):
            if (public / excluded).exists():
                errors.append(f"Nonpublic project material appeared in dist: {excluded}")
    return list(dict.fromkeys(errors)), list(dict.fromkeys(warnings)), json_count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, help="Validate an already generated public directory.")
    args = parser.parse_args()
    errors, warnings, count = validate(dist=args.dist)
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        print(f"Validation failed: {len(errors)} issue(s).")
        return 1
    print(f"Validation passed: {count} content JSON file(s); references and public boundaries checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
