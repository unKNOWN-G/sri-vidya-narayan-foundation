#!/usr/bin/env python3
"""Check the editorial navigation graph, independently of the UI renderer.

Validates that every published occasion is discoverable from a published category,
and that books, message pages/originals, and giving records have real destinations.
This does not replace browser checks of the controls that expose those links.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict, deque
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import quote, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
MEDIA_TYPES = {"photo", "video", "audio", "document", "youtube", "message"}
COUNT_TYPES = {"photos": "photo", "films": "video", "videos": "video", "recordings": "audio", "audio": "audio", "documents": "document", "youtube": "youtube", "messages": "message"}
REQUIRED_COLLECTIONS = {"readings", "pearls", "teachings", "books", "messages", "contributions"}


def entries(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for field in ("entries", "readings", "messages", "books", "teachings", "pearls", "records"):
            if isinstance(data.get(field), list):
                return data[field]
    return []


def check(root=ROOT, require_experiences=False):
    root = Path(root).resolve()
    errors, warnings = [], []
    graph = defaultdict(set)
    routes = set()
    resources = set()

    def fail(message):
        errors.append(message)

    def load(path):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            fail(f"Cannot read {path.relative_to(root)}: {exc}")
            return {}

    def link(parent, child):
        graph[parent].add(child)

    def local_resource(value, context, required=True):
        if not value:
            if required:
                fail(f"{context}: no destination supplied")
            return False
        if not isinstance(value, str):
            fail(f"{context}: destination must be a string")
            return False
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc:
            if parsed.scheme not in ("https", "http") or not parsed.netloc:
                fail(f"{context}: unsupported URL {value}")
                return False
            resources.add(value)
            return True
        target = (root / unquote(parsed.path)).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            fail(f"{context}: missing or unsafe destination {value}")
            return False
        if not parsed.path.startswith("assets/"):
            fail(f"{context}: public media must use an assets/ path, got {value}")
            return False
        resources.add(value)
        return True

    def records(folder, label):
        result = {}
        for file in sorted(folder.glob("*.json")):
            record = load(file)
            identifier = record.get("id") if isinstance(record, dict) else None
            if not isinstance(identifier, str) or not identifier:
                fail(f"{label} record needs a stable id: {file.name}")
            elif identifier in result:
                fail(f"Duplicate {label} id: {identifier}")
            else:
                result[identifier] = record
        return result

    def identified(items, label):
        result = {}
        for item in items:
            identifier = item.get("id", item.get("number")) if isinstance(item, dict) else None
            if identifier is None or str(identifier) == "":
                fail(f"{label}: an item has no stable id/number")
            elif str(identifier) in result:
                fail(f"{label}: duplicate item id {identifier}")
            else:
                result[str(identifier)] = item
        return result

    site = load(root / "content/site.json")
    directories = site.get("contentDirectories", {})
    categories = records(root / "content" / directories.get("categories", "categories"), "category")
    events = records(root / "content" / directories.get("events", "events"), "event")
    public_categories = {key: value for key, value in categories.items() if value.get("published") is not False}
    public_events = {key: value for key, value in events.items() if value.get("published") is not False}
    home = "#/"
    routes.add(home)
    routes.add("#/explore")
    routes.update({"#/learn", "#/foundation"})
    link(home, "#/explore")
    link(home, "#/learn")
    link(home, "#/foundation")
    featured = site.get("homeCards", list(public_categories))
    if len(featured) != len(set(featured)):
        fail("Homepage card IDs must be unique")
    for identifier in featured:
        if identifier not in public_categories:
            fail(f"Homepage card {identifier}: missing or unpublished category")
    secondary = site.get("secondaryCategories", [])
    listed_events = set()
    for identifier, category in public_categories.items():
        node = "#/category/" + quote(identifier)
        routes.add(node)
        if identifier in featured:
            link(home, node)
            link("#/explore", node)
        elif identifier in secondary:
            link("#/foundation", node)
        local_resource(category.get("cover"), f"Category {identifier} cover")
        declared = category.get("eventIds", [])
        if not isinstance(declared, list):
            fail(f"Category {identifier}: eventIds must be an array")
            continue
        if len(declared) != len(set(declared)):
            fail(f"Category {identifier}: duplicate eventIds")
        for event_id in declared:
            if event_id not in events:
                fail(f"Category {identifier}: missing event {event_id}")
            elif event_id not in public_events:
                fail(f"Category {identifier}: links to unpublished event {event_id}")
            else:
                event_node = "#/event/" + quote(event_id)
                story_node = node + "/moments/" + quote(event_id)
                routes.add(story_node)
                link(node, story_node)
                link(story_node, event_node)
                listed_events.add(event_id)
                link(node, event_node)

    media_totals = Counter()
    asset_events = defaultdict(set)
    for identifier, event in public_events.items():
        node = "#/event/" + quote(identifier)
        routes.add(node)
        category_id = event.get("category")
        if category_id not in public_categories:
            fail(f"Event {identifier}: primary category {category_id!r} is missing or unpublished")
        elif identifier not in public_categories[category_id].get("eventIds", []):
            fail(f"Event {identifier}: primary category does not list this event")
        local_resource(event.get("cover"), f"Event {identifier} cover")
        media = event.get("media", [])
        if not isinstance(media, list) or not media:
            fail(f"Published event {identifier}: no media")
            continue
        media_ids = set()
        counts = Counter()
        for index, item in enumerate(media):
            kind = item.get("type")
            media_id = item.get("id")
            if not media_id or media_id in media_ids:
                fail(f"Event {identifier}: missing/duplicate media id at item {index + 1}")
            media_ids.add(media_id)
            if kind not in MEDIA_TYPES:
                fail(f"Event {identifier}: unsupported media type {kind!r}")
                continue
            type_index = counts[kind]
            counts[kind] += 1
            media_totals[kind] += 1
            media_route = f"{node}/{kind}/{type_index}"
            routes.add(media_route)
            link(node, media_route)
            destination = item.get("url") or item.get("src") if kind == "youtube" else item.get("src")
            local_resource(destination, f"Event {identifier}, {kind} {type_index + 1}")
            if item.get("src"):
                asset_events[item["src"]].add(identifier)
            for optional in ("thumb", "poster"):
                if item.get(optional):
                    local_resource(item[optional], f"Event {identifier} {optional}")
        declared_counts = Counter()
        for label, amount in event.get("counts", {}).items():
            if label in COUNT_TYPES:
                declared_counts[COUNT_TYPES[label]] += amount
        if declared_counts and declared_counts != counts:
            fail(f"Event {identifier}: displayed media counts differ from actual media")

    collections = {}
    for name in REQUIRED_COLLECTIONS - set(site.get("collections", {})):
        fail(f"Missing website collection: {name}")
    for name, relative in site.get("collections", {}).items():
        path = (root / relative).resolve()
        if not path.is_relative_to(root / "content"):
            fail(f"Collection {name}: JSON must stay within content/")
            continue
        collections[name] = load(path)
    if "teachings" not in public_categories:
        fail("The public wisdom/teachings entry point is missing")
    for name, data in collections.items():
        if name in ("contributions", "supportLinks", "educationProfiles"):
            continue
        node = "#/library/" + quote(name)
        routes.add(node)
        link("#/category/teachings", node)
        link("#/learn", node)
        items = identified(entries(data), name)
        if not items:
            fail(f"Public library collection {name}: no readable items")
        for identifier in items:
            if name == "books":
                continue  # Books open their actual reader/publication destination below.
            item_route = ("#/message/" + quote(identifier)) if name == "messages" else f"#/read/{quote(name)}/{quote(identifier)}"
            routes.add(item_route)
            link(node, item_route)

    book_links = {}
    for identifier, book in identified(entries(collections.get("books", [])), "books").items():
        local_resource(book.get("cover") or book.get("src"), f"Book {identifier} cover")
        reader = book.get("reader")
        if reader:
            if reader not in collections or not entries(collections[reader]):
                fail(f"Book {identifier}: missing/empty reading collection {reader}")
            else:
                book_links[identifier] = "reading-room.html" if reader == "pearls" else "#/library/" + reader
                routes.add(book_links[identifier])
                link("#/library/books", book_links[identifier])
        elif book.get("purchaseUrl"):
            local_resource(book["purchaseUrl"], f"Book {identifier} publication link")
            book_links[identifier] = book["purchaseUrl"]
            link("#/library/books", book_links[identifier])
        else:
            fail(f"Book {identifier}: no reading edition or publication destination")

    card_path = root / "content" / "collections" / "cards.json"
    presentations = {c.get("id"): c for c in entries(load(card_path))} if card_path.is_file() else {}
    message_summary = []
    for identifier, message in identified(entries(collections.get("messages", [])), "messages").items():
        node = "#/message/" + quote(identifier)
        standalone_route = "message-cards.html#" + quote(identifier)
        routes.add(standalone_route)
        link("#/library/messages", standalone_route)
        pages = message.get("pages", [])
        panels = message.get("readingPanels", [])
        original = message.get("originalPdf") or {}
        original_src = original.get("src") if isinstance(original, dict) else original
        original_src = original_src or message.get("originalUrl")
        if not pages and not original_src:
            fail(f"Message {identifier}: no supplied page image or original document")
        local_resource(message.get("cover") or message.get("src"), f"Message {identifier} cover")
        for index, page in enumerate(pages):
            local_resource(page.get("src"), f"Message {identifier} original page {index + 1}")
            target = f"#/event/message-{quote(identifier)}/photo/{index}"
            routes.add(target)
            link(node, target)
        if message.get("sourcePageCount") is not None and len(pages) != message["sourcePageCount"]:
            fail(f"Message {identifier}: sourcePageCount does not match page images")
        if message.get("readingPanelCount") is not None and len(panels) != message["readingPanelCount"]:
            fail(f"Message {identifier}: readingPanelCount does not match panels")
        empty_panels = []
        for index, panel in enumerate(panels):
            if panel.get("src"):
                local_resource(panel["src"], f"Message {identifier} reading panel {index + 1}")
            if not panel.get("src") and not str(panel.get("text", "")).strip():
                empty_panels.append(index + 1)
        folded = presentations.get(identifier, {})
        sheets = folded.get("sheets", {})
        has_sheet_fallback = folded.get("type") == "folded" and sheets.get("outside") and sheets.get("inside")
        if has_sheet_fallback:
            local_resource(sheets["outside"], f"Message {identifier} outside sheet fallback")
            local_resource(sheets["inside"], f"Message {identifier} inside sheet fallback")
        if empty_panels and not has_sheet_fallback:
            warnings.append(f"Message {identifier}: panels {empty_panels} need an original-image fallback, not an empty text reader")
        if original_src:
            local_resource(original_src, f"Message {identifier} original document")
            target = f"#/event/message-{quote(identifier)}/document/0"
            routes.add(target)
            link(node, target)
        message_summary.append({"id": identifier, "originalPages": len(pages), "readingPanels": len(panels), "originalDocument": original_src, "emptyTextPanels": empty_panels})

    record_links = {}
    giving = "#/category/foundation/records"
    routes.add(giving)
    link("#/category/foundation", giving)
    link("#/foundation", giving)
    if "foundation" not in public_categories:
        fail("The foundation entry point for historical giving is missing")
    contribution_data = collections.get("contributions", {})
    for identifier, record in identified(entries(contribution_data), "contributions").items():
        node = "#/record/" + quote(identifier)
        routes.add(node)
        link(giving, node)
        source = record.get("src")
        if source:
            local_resource(source, f"Giving record {identifier} acknowledgement")
        elif str(record.get("evidenceStatus", "")).startswith("documented"):
            fail(f"Giving record {identifier}: documented amount has no supporting public destination")
        related = set(asset_events.get(source, set())) if source else set()
        if identifier in public_events:
            related.add(identifier)
        for event_id in record.get("eventIds", []):
            if event_id not in public_events:
                fail(f"Giving record {identifier}: unknown/unpublished related event {event_id}")
            else:
                related.add(event_id)
        if record.get("eventId"):
            if record["eventId"] not in public_events:
                fail(f"Giving record {identifier}: unknown/unpublished related event {record['eventId']}")
            else:
                related.add(record["eventId"])
        record_links[identifier] = sorted(related)
        if not related:
            warnings.append(f"Giving record {identifier}: no related occasion found by explicit ID, exact ID, or shared source")

    # A service story must not mix education, food, medical, and temple records.
    support_by_id = {str(r.get("id")): r for r in contribution_data.get("records", [])}
    cause_aliases = {"medical": "healthcare", "temple": "foundation"}
    display_groups = identified(contribution_data.get("displayGroups", []), "contribution display groups")
    grouped_records = set()
    for group_id, group in display_groups.items():
        node = "#/record/" + quote(group_id)
        routes.add(node)
        link(giving, node)
        if group_id in support_by_id:
            fail(f"Contribution group {group_id}: ID collides with a contribution record")
        if not group.get("recordIds"):
            fail(f"Contribution group {group_id}: no supporting receipt records")
        for record_id in group.get("recordIds", []):
            record = support_by_id.get(record_id)
            if not record or record.get("category") != group.get("category"):
                fail(f"Contribution group {group_id}: receipt {record_id} is missing or belongs to a different cause")
            if record_id in grouped_records:
                fail(f"Contribution group {group_id}: receipt {record_id} is included more than once")
            grouped_records.add(record_id)
            link("#/record/" + quote(record_id), node)
    for identifier, event in public_events.items():
        if event.get("presentation") != "service-story":
            continue
        if not event.get("cover") or "/his-holiness/" in event["cover"]:
            fail(f"Service story {identifier}: use a recipient or place photograph, not an unrelated portrait")
        if event.get("supportGroupId"):
            group = display_groups.get(event["supportGroupId"])
            if not group or cause_aliases.get(group.get("category"), group.get("category")) != event.get("category"):
                fail(f"Service story {identifier}: missing or incorrectly categorized contribution group")
        for record_id in event.get("supportRecordIds", []):
            record = support_by_id.get(str(record_id))
            if not record:
                fail(f"Service story {identifier}: missing support record {record_id}")
            elif cause_aliases.get(record.get("category"), record.get("category")) != event.get("category"):
                fail(f"Service story {identifier}: support record {record_id} belongs to a different cause")

    education_profiles = collections.get("educationProfiles", [])
    education_records = {str(r.get("id")): r for r in contribution_data.get("records", [])}
    for profile in entries(education_profiles):
        event = public_events.get(profile.get("eventId"))
        if not event or event.get("category") != "education":
            fail(f"School profile {profile.get('id')}: missing education event")
        for record_id in profile.get("recordIds", []):
            if education_records.get(record_id, {}).get("category") != "education":
                fail(f"School profile {profile.get('id')}: contribution {record_id} is missing or belongs to another cause")

    reached = {home}
    queue = deque([home])
    while queue:
        for child in graph[queue.popleft()]:
            if child not in reached:
                reached.add(child)
                queue.append(child)
    unreachable = sorted(identifier for identifier in public_events if "#/event/" + quote(identifier) not in reached)
    if unreachable:
        fail("Published events not discoverable from the portraits: " + ", ".join(unreachable))
    for identifier, event in public_events.items():
        for field in ("recordIds", "relatedRecordIds"):
            known = identified(entries(contribution_data), "contributions")
            for record_id in event.get(field, []):
                if record_id not in known:
                    fail(f"Event {identifier}: unknown giving record {record_id}")

    # These are separate documents with native return links, not hash-only views.
    # Presence/dependencies are enforceable once the dedicated experiences are ported.
    standalone = {}
    class Dependencies(HTMLParser):
        def __init__(self):
            super().__init__()
            self.values = []
        def handle_starttag(self, tag, attrs):
            values = dict(attrs)
            if tag in ("script", "link"):
                value = values.get("src") if tag == "script" else values.get("href")
                if value:
                    self.values.append(value)
    for filename in ("reading-room.html", "message-cards.html"):
        path = root / "src" / filename
        standalone[filename] = {"present": path.is_file(), "missingDependencies": []}
        if not path.is_file():
            (fail if require_experiences else warnings.append)(f"Dedicated experience not yet available: {filename}")
            continue
        routes.add(filename)
        parser = Dependencies()
        parser.feed(path.read_text(encoding="utf-8"))
        for value in parser.values:
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc:
                continue
            target = (root / "src" / unquote(parsed.path)).resolve()
            if not target.is_relative_to(root / "src") or not target.is_file():
                standalone[filename]["missingDependencies"].append(value)
                (fail if require_experiences else warnings.append)(f"Dedicated experience {filename}: missing dependency {value}")

    return {
        "errors": list(dict.fromkeys(errors)),
        "warnings": list(dict.fromkeys(warnings)),
        "summary": {"publishedCategories": len(public_categories), "draftCategories": len(categories) - len(public_categories), "publishedEvents": len(public_events), "draftEvents": len(events) - len(public_events), "reachableEvents": len(public_events) - len(unreachable), "eventMedia": dict(media_totals), "books": len(book_links), "messages": len(message_summary), "givingRecords": len(record_links), "localAndExternalDestinations": len(resources)},
        "unreachableEvents": unreachable,
        "bookDestinations": book_links,
        "messages": message_summary,
        "givingRecordRelatedEvents": record_links,
        "dedicatedExperiences": standalone,
        "expectedPublicRoutes": sorted(routes),
        "limits": ["Checks source data and destination files; browser controls still require interaction testing.", "External URL syntax is checked, not remote availability.", "Reading panels without source images must use their supplied original-page fallback where needed."],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Project root; useful for isolated fixtures.")
    parser.add_argument("--json", type=Path, help="Write the full expected-route and relationship report.")
    parser.add_argument("--require-experiences", action="store_true", help="Also fail when a dedicated reader/message page or its dependencies are missing.")
    args = parser.parse_args()
    report = check(args.root, args.require_experiences)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for value in report["warnings"]:
        print("WARNING:", value)
    for value in report["errors"]:
        print("ERROR:", value)
    summary = report["summary"]
    print(f"Content routes: {summary['reachableEvents']}/{summary['publishedEvents']} events reachable; {summary['books']} books; {summary['messages']} message collections; {summary['givingRecords']} giving records.")
    print("FAILED" if report["errors"] else "PASSED")
    return int(bool(report["errors"]))


if __name__ == "__main__":
    sys.exit(main())
