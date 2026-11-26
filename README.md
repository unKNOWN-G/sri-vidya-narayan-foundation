# Sri Vidya Narayan Foundation

[Visit the website](https://unknown-g.github.io/sri-vidya-narayan-foundation/) · [GitHub repository](https://github.com/unKNOWN-G/sri-vidya-narayan-foundation)

A photograph-led tribute to **Sri Vidyanarayana Thirtha Swamiji**, presented through the foundation. Visitors begin with the side of his life that interests them, then open an occasion, gallery, reflection, book, or supporting record.

The website is a static project: HTML, CSS, browser JavaScript, JSON content, and reviewed media. Building and previewing it require **Python 3.9 or later**. There is no npm installation step, service account, or frontend database.

## Experience and navigation

Start with [the navigation skeleton](docs/EXPERIENCE_BLUEPRINT.md). Its interactive planning view is `blueprint.html` in a local build.

The visitor sees one shared, centred card carousel throughout the inner sections: a real photograph or book cover, visible neighbouring cards, essential captions and a numbered bottom strip. The teaching gateway is `#/learn`. Satsangs use a photo-led reading card with calendar and theme filters; practical teachings show one reflection at a time; Books uses real covers; `reading-room.html` preserves the opening/page-turning Pearls experience; `message-cards.html` preserves the rotating/folded-card experience. Supporting acknowledgements sit behind service stories.

Within each occasion, Next/Previous continues from photographs to videos and audio, then supporting documents. The visible Continue link identifies the next media type; tabs and the combined thumbnail strip offer direct access. Media changes preserve the viewer and do not add a browser-history entry for every item. Hold a thumbnail and slide to scrub through the main view; holding near an edge reveals more thumbnails. Ordinary dragging scrolls the strip, and taps or keyboard arrows still select individual items.

The shared shell is footer-free: utilities live in More, while each inner card keeps a short factual introduction. Everyday Teachings uses subject illustrations instead of repeated portrait placeholders. On phones, swipe and named tabs keep navigation compact; desktop arrows appear on hover or keyboard focus.

## Start locally

```sh
python3 scripts/validate.py
python3 scripts/build.py
python3 scripts/serve.py --port 8876
```

Open the local URL printed by the preview command. The server binds to `127.0.0.1`. If the requested port is busy it selects the next available port and prints that address. The earlier website on port 8765 is independent.

Rebuild after changing source or content, then refresh the browser. To run the existing build without rebuilding:

```sh
python3 scripts/serve.py --port 8876 --no-build
```

## Where things belong

| Folder | Purpose | Included in the public build? |
| --- | --- | --- |
| `src/` | The interface, styles, and browser behaviour | Yes |
| `content/` | Site index, individual category/event records, and reading collections | Yes |
| `assets/` | Web-ready photographs, covers, audio/video, fonts, and complete reviewed document pages | Yes |
| `media/` | Unchanged originals, organized by category, event, and media type; local catalog with provenance | No; ignored by Git |
| `incoming/` | New material awaiting classification and review | No; ignored by Git |
| `docs/` | Content model, design plan, upload guide, and repository map | No |
| `scripts/` | Build, preview, and validation tools | No |
| `dist/` | Generated deployable website | Output only; ignored by Git |

Start with [the design plan](docs/DESIGN_PLAN.md), [content model](docs/CONTENT_MODEL.md), [upload guide](docs/UPLOAD_GUIDE.md), and [repository map](docs/REPOSITORY_MAP.md). `PROJECT.json` is the short machine-readable project description.

Edit categories in `content/categories/*.json`, events in `content/events/*.json`, and reading collections in `content/collections/`. The source `content/site.json` contains site settings, collection paths, category order, and `contentDirectories`; its category/event arrays can remain empty. The build assembles their public counterparts in `dist/content/site.json` without modifying the source index.

Events marked `published: false` remain local drafts and are excluded from both the public index and generated event files.

The initial content import is a frozen snapshot, not a live synchronization with the earlier website or other chats. Music/concert material remains an editorial draft until actual photographs are supplied.

## Add future material

Create one event folder, keep the original files unchanged in the local archive, prepare appropriately sized public derivatives, and add the reviewed event to the content manifest. Do not use filenames as evidence of an event date. Do not create a new homepage category for each visit.

The guided file-import command is `python3 scripts/add_event.py`. See the upload guide for a complete example, supported media, draft handling, and the explicit options for reviewed documents or a draft category.

See [the upload guide](docs/UPLOAD_GUIDE.md) for the file-based process. A separate private photo uploader, with no Meta or customer GitHub login, is implemented under `services/uploader/`. Its remote hosting and publishing access must be connected before it can publish; see [the uploader setup and current status](docs/UPLOADER_SETUP.md).

## Build and check

`scripts/build.py` copies `src/`, `content/`, and `assets/` into `dist/`, then checks the result. It never copies the original-media archive, private material, source catalog, or repository documentation into the public site.

The build also generates the message-card and Pearls JavaScript data bundles from `content/collections/cards.json` and `content/collections/pearls.json`. Edit those canonical JSON files; their matching source JavaScript files are documentation stubs. Stylesheets and scripts receive content-based cache versions throughout the built HTML.

The build adds content-based version labels to the main stylesheet and script URLs so a refreshed preview receives the updated interface.

`scripts/validate.py` checks required files, JSON syntax, the category collection, local HTML/CSS references, public asset references in content, and accidental local-source paths. It reports unusually large public assets so media delivery can be reviewed. Visual interaction, typography, caption accuracy, and real video/audio playback still require a focused browser check.

`python3 scripts/check_content_routes.py --require-experiences` independently checks story discovery, book readers, original message documents, giving evidence, and the dedicated reading experiences. See [the navigation audit](docs/NAVIGATION_AUDIT.md) for its scope and the browser acceptance checks. Its isolated regression fixtures run with `python3 -m unittest discover -s tests -p test_content_routes.py`.

## GitHub and publishing

The repository contains a **manual** GitHub Pages workflow in `.github/workflows/pages.yml`. This project is published from this repository. For an update, push the reviewed source, then run **Publish website** from the Actions tab. A local build does not publish anything.

The workflow follows [GitHub's custom Pages workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Keep relative asset URLs so the site works below a repository path as well as on a custom domain.

The ignored originals archive must be backed up separately. A clone of this Git repository contains the reviewed website source and public assets, not the complete local archive. If original media later need shared version control, decide on Git LFS or external storage explicitly; this project does not silently require either service.

See [RIGHTS.md](RIGHTS.md) for the treatment of supplied media, book covers, documents, fonts, and source code. This repository does not automatically place those materials under an open-source license.

## Editorial boundary

This is a tribute to a living spiritual guide. Use accurate actions and actual photographs. Source notes distinguish institution history, owner-supplied visit identification, approximate contributions, and verified supporting records. Book collections compile teachings; teaching summaries and reflections are not automatically direct quotations.

No payment processing, scholarship application form, public media upload service, or collection of private visitor details is implied by this project.
