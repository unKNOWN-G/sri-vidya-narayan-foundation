# Content model

The website separates **a side of Swamiji's life**, **an occasion or body of work**, and **the individual material that illustrates it**. These are different levels of the same collection.

## 1. Categories are the stable entry points

Use a small, intelligible set of public categories. The starting experience should answer what Swamiji does without requiring visitors to read a menu of administrative terms.

| Perspective | Material it can contain | Editorial boundary |
| --- | --- | --- |
| His Holiness Shankaracharya | Monastic life, spiritual observances, older portraits, Guru Purnima, Chaturmasya, Stuti | Attribute personal accounts. Do not infer an occasion or date from a generic portrait. |
| Education | School establishment, school and college visits, scholarship support, inclusive education | Distinguish a school established by Swamiji from a school he visited or supported. |
| Vedic learning | Veda Patashala visits, Veda parayanam, traditional study | Describe the documented occasion; do not imply a donation when only a visit is known. |
| Medical care and welfare | Medical contributions, documented camps, children's and elders' welfare | Distinguish direct medical support from the wider activities of a visited institution. |
| Music and devotion | Actual music photographs, concerts, performances, devotional gatherings | Use supplied occasion material. A decorative instrument drawing is not evidence of a concert. |
| Wisdom and books | Book covers, publication information, teaching collections | Identify compilations and compilers accurately. Do not invent book proceeds or availability. |
| Satsang and messages | Dated reflections, daily reading, event messages, source-linked summaries | Label paraphrases and preserve the distinction between session date and file upload date. |
| Service and giving | Annadanam, acknowledged contributions, source excerpts | Count each contribution once. Preserve approximate versus exact amounts. |

The IDs in the individual files under `content/categories/` and `content/events/` are canonical. This table describes the editorial grouping; it does not require rewriting valid IDs when labels change.

Trust/foundation information is supporting context: purpose, contact, ways to participate, and reviewed records. It should remain accessible without turning the tribute into an institutional brochure.

## 2. Events and collections carry the detail

One school visit, concert, medical camp, celebration, or publication collection receives one stable event/collection ID. Several photos, clips, audio files, and documents can belong to it.

A visit record should carry the institution or occasion, place, a meaningful short caption, an optional confirmed date, its category, the media IDs or public asset paths, and supporting links. Keep unknown dates as `null` or omit them. A diary's printed date or a WhatsApp filename is not sufficient evidence of an event date.

Use event slugs that describe the occasion, such as `madanapalle-sgdc-visit`, rather than `new-photos` or a computer's download-folder name. If the date is later confirmed, update its date field rather than changing its permanent ID.

## 3. Public content and local provenance are separate

The source `content/site.json` is the site index: settings, collection paths, `categoryOrder`, and a `contentDirectories` mapping. Individual category records live in `content/categories/*.json`; individual event records live in `content/events/*.json`. Reading collections live in `content/collections/`.

The build copies those reviewed records and assembles the `categories` and `events` arrays in **`dist/content/site.json` only**. Source arrays may remain empty. Edit the individual source files, not a duplicate inline array or the generated manifest. Categories follow `categoryOrder`; optional `eventOrder` or per-record numeric `order` can establish an editorial sequence, with stable ID ordering as the fallback.

Public records may contain titles, summaries, public URLs, captions, media types, image dimensions, book information, and short source attributions. Keep authoring templates under `docs/`, outside the public content tree.

### Dedicated readers have canonical content, too

`content/collections/cards.json` is the authoritative presentation collection for the separate message-card experience. It preserves the supplied card IDs, page text/images, `sheets.outside`/`sheets.inside`, fold type, cover choices, aspect ratio, artwork positions, theme, and original-document URL. Edit this JSON when correcting a card presentation. Keep its IDs aligned with `content/collections/messages.json`, which provides the main library's editorial index and original-page/panel metadata. A folded sheet is not an interchangeable flat page: retain its arrangement and test opening, page turns, enlargement, and the original PDF after edits.

`content/collections/pearls.json` → `entries` is the single source for all 180 Pearls in both the library and dedicated reading room. Edit its entries rather than a JavaScript data copy.

During a build, `scripts/build.py` generates `dist/event-cards-data.js` (`window.foundationEventCards`) from `cards.json` and `dist/pearls-data.js` (`window.pearlsOfWisdom`) from the Pearls entries. The matching `src/` files are explanatory stubs. They intentionally contain no duplicate editorial content, so preview the built site using `scripts/serve.py`. Every local stylesheet and script referenced by generated HTML receives a content-based version, including the dedicated readers and experience styles.

An event with `published: false` is a local editorial draft. The build omits it from the public event array and removes its generated individual JSON file, so a direct URL cannot reveal an unpublished event. The source draft remains unchanged. A draft category may remain in metadata with `published: false`; the interface excludes it from public entry points.

`media/catalog.json` is the local archival manifest. The media library uses an `items` array with fields such as:

```json
{
  "id": "stable-media-id",
  "category": "education",
  "event": "madanapalle-sgdc-visit",
  "type": "photo",
  "src": "assets/media/education/madanapalle-sgdc-visit/photo-01.webp",
  "thumb": "assets/media/education/madanapalle-sgdc-visit/photo-01.thumb.webp",
  "local_original": "media/education/madanapalle-sgdc-visit/photos/photo-01.jpeg",
  "source_asset": "original-source-filename.jpeg",
  "source_path": "local-only provenance; not copied into public content",
  "sha256": "checksum-of-the-unchanged-original",
  "bytes": 123456,
  "width": 1600,
  "height": 1200,
  "alt": "A concise description of the photograph",
  "caption": "What this moment demonstrates",
  "provenance": "Owner-supplied visit identification and photograph",
  "eligible": true
}
```

The catalog can also retain excluded material with `eligible: false` and an `exclusion_reason`. The public build never copies this catalog; the public presentation must use reviewed fields only.

## 4. Writing for discovery

A category title should identify a perspective or action. An event caption should explain the photograph. The short description adds the context a photograph cannot establish on its own.

- Prefer **Medical care & children's welfare** to an unexplained abstract label.
- Prefer **A visit with students at SGDC, Madanapalle** to **A memorable occasion**.
- Use a specific invitation such as **See the school visits**, **Open the Stuti**, or **Read this reflection**.
- Preserve actual names and relevant institution details; trim repetition before removing meaning.

Do not set a numerical target for testimonials, impact totals, or categories that forces unsupported material into the site. A well-captioned real moment is sufficient.

## 5. Documents and evidence

The source archive may contain documents unsuitable for public release. Only previously reviewed public excerpts or newly reviewed public documents belong under `assets/`. Do not copy original payment instruments, signatures, private contact information, student tables, or personal medical records into a gallery.

Record whether an amount is an acknowledged contribution, a corpus statement, annual interest, an award, an estimate, or a proposal. Those values are not interchangeable and should not be added together merely because they are amounts.
