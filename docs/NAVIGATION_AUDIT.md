# Editorial navigation audit

The redesigned experience must connect a visitor to a story, then to its photographs, recordings, words, or supporting records. A file existing in the repository does not establish that its control works. This audit therefore separates the source-data graph from browser interaction checks.

## Source snapshot checked

The current canonical category/event files connect **40 published occasions** to **9 public categories**. Music remains an unpublished category until authentic supplied material is ready. The wisdom collections include 8 books, 8 message collections, daily readings, 180 Pearls, and practical teachings. All 12 historical giving records connect to an actual occasion using a shared public excerpt or an exact canonical event ID.

Run the independent graph check after editing content:

```sh
python3 scripts/check_content_routes.py --require-experiences --json work/content-route-check.json
python3 -m unittest discover -s tests -p test_content_routes.py
```

The checker verifies category membership, orphaned occasions, media counts and files, book reading/publication destinations, supplied message page images and original PDFs, historical giving evidence, and dependencies of the separate reading room/message experience. Its regression fixtures intentionally break a category link, book reader, original PDF, documented giving record, and separate reader dependency.

## Connections identified for the redesign

- Six supplied message originals use `originalPdf.src`. A control that checks only `originalUrl` loses those PDFs.
- Original page images and readable folded panels are distinct. Guru Purnima 2024 and Dhanvantari each supply 4 reading panels from 2 original page images. Retain both experiences.
- Dhanvantari panels 1 and 4 contain cover/back artwork metadata with no standalone text or cropped image. Use the supplied original-page image as their fallback; avoid empty reading scenes.
- Historical giving uses the editorial categories `medical` and `temple`; the public categories are `healthcare` and `foundation`. Preserve the record labels while mapping navigation explicitly.
- Four educational acknowledgements belong to the `school-awards` occasion, while Navajeevan's educational support belongs with its actual `navajeevan` occasion. A category-name-only match loses these connections.
- Supporting excerpts belong behind the related story. A receipt should not replace its story's first scene.
- Pearls opens `reading-room.html`; message cards open `message-cards.html`. Preserve their native page turns/folds, original-document controls, and return links.

These are findings from the pre-redesign renderer snapshot, not a claim that the actively revised renderer still has each issue.

## Service crosslinks

[SERVICE_LINKS.json](SERVICE_LINKS.json) records the evidence-backed mapping from each historical giving record to its related occasion. Eleven links share the exact published source excerpt. Navajeevan uses the exact canonical event ID; its amount remains owner-reported and approximate. A crosslink never changes the donor, recipient, date, amount, or evidence status.

## Browser acceptance checks

1. From the portrait carousel, open every public category and reach every story without relying on page scrolling.
2. Open a photo, film, audio recording, original document, and external video; return to the same story. Test direct links and refresh.
3. Open Pearls from Books, turn a page, use a `reading-room.html#pearl-<number>` link, and return to Books.
4. Open every message card; turn the original pages and folded reading panels. Verify all six original PDF controls and the two Dhanvantari art fallbacks.
5. Open service details from a related story, view the supporting excerpt, and return to that story. Preserve qualifications on approximate or attributed contributions.
6. Check keyboard focus, Escape/Back, touch swipe, motion pause, narrow screens, and native audio/video controls. A graph check cannot establish those behaviors.

External URLs are checked for valid destination syntax only; remote availability and purchase stock are not promised.
