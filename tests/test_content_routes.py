"""Regression fixtures for editorial connections, independent of UI markup."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("content_routes", Path(__file__).resolve().parents[1] / "scripts/check_content_routes.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ContentRoutesTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.write("content/site.json", {"contentDirectories": {"categories": "categories", "events": "events"}, "collections": {name: f"content/collections/{name}.json" for name in MODULE.REQUIRED_COLLECTIONS}})
        for name in ("teachings", "foundation", "education"):
            self.write(f"content/categories/{name}.json", {"id": name, "cover": "assets/photo.webp", "eventIds": ["school"] if name == "education" else []})
        self.write("content/events/school.json", {"id": "school", "category": "education", "cover": "assets/photo.webp", "media": [{"id": "school-photo", "type": "photo", "src": "assets/photo.webp"}], "counts": {"photos": 1}})
        for name in ("readings", "pearls", "teachings"):
            self.write(f"content/collections/{name}.json", [{"id": "one", "text": "A supplied teaching."}])
        self.write("content/collections/books.json", [{"id": "book", "cover": "assets/photo.webp", "reader": "pearls"}])
        self.write("content/collections/messages.json", [{"id": "message", "cover": "assets/photo.webp", "pages": [{"src": "assets/photo.webp"}], "originalPdf": {"src": "assets/original.pdf"}}])
        self.write("content/collections/contributions.json", {"records": [{"id": "support", "src": "assets/photo.webp", "evidenceStatus": "documented"}]})
        for relative in ("assets/photo.webp", "assets/original.pdf", "src/reader.js"):
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(b"fixture")
        for name in ("reading-room.html", "message-cards.html"):
            (self.root / "src" / name).write_text('<script src="reader.js"></script>')

    def write(self, relative, data):
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(data))

    def errors(self):
        return "\n".join(MODULE.check(self.root, require_experiences=True)["errors"])

    def test_valid_fixture_connects_occasion_and_giving_record(self):
        report = MODULE.check(self.root, require_experiences=True)
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["givingRecordRelatedEvents"]["support"], ["school"])

    def test_orphaned_occasion_is_detected(self):
        self.write("content/categories/education.json", {"id": "education", "cover": "assets/photo.webp", "eventIds": []})
        self.assertIn("not discoverable", self.errors())

    def test_missing_book_reader_is_detected(self):
        self.write("content/collections/books.json", [{"id": "book", "cover": "assets/photo.webp", "reader": "unavailable"}])
        self.assertIn("missing/empty reading collection unavailable", self.errors())

    def test_missing_original_message_pdf_is_detected(self):
        (self.root / "assets/original.pdf").unlink()
        self.assertIn("Message message original document: missing", self.errors())

    def test_missing_giving_evidence_is_detected(self):
        self.write("content/collections/contributions.json", {"records": [{"id": "support", "evidenceStatus": "documented"}]})
        self.assertIn("documented amount has no supporting public destination", self.errors())

    def test_broken_dedicated_reader_dependency_is_detected(self):
        (self.root / "src/reader.js").unlink()
        self.assertIn("missing dependency reader.js", self.errors())


if __name__ == "__main__":
    unittest.main()
