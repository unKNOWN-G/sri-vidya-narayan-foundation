# Repository map

```text
sri-vidya-narayan-foundation/
├── PROJECT.json                  Machine-readable project description
├── README.md                     Start, build, preview, and publish instructions
├── AGENTS.md                     Rules for future coding/content work
├── .gitignore                    Excludes originals, intake, private work, and dist
├── .gitattributes                Text and binary handling; no implicit LFS dependency
├── .github/workflows/pages.yml   Manual GitHub Pages publication workflow
├── src/
│   ├── index.html                Website shell
│   ├── styles.css                Visual system, themes, responsive layouts
│   ├── app.js                    Discovery, navigation, viewers, and reading behaviour
│   ├── reading-room.html         Dedicated Pearls page-turning experience
│   ├── message-cards.html        Dedicated message-card/fold experience
│   ├── event-cards-data.js       Stub; generated from collections/cards.json
│   └── pearls-data.js            Stub; generated from collections/pearls.json
├── content/
│   ├── site.json                 Site index, collection paths, and category order
│   ├── categories/*.json         One canonical record per perspective
│   ├── events/*.json             One canonical record per occasion/collection
│   └── collections/*.json        Readings, books, messages, card presentation, and records
├── assets/
│   ├── media/<category>/<event>/ Reviewed web-ready assets
│   └── ...                       Fonts and other reviewed public assets
├── media/                        LOCAL ARCHIVE — not public, ignored by Git
│   ├── catalog.json              Source provenance, hashes, and public derivative mapping
│   └── <category>/<event>/
│       ├── photos/
│       ├── videos/
│       ├── audio/
│       └── documents/
├── incoming/                     LOCAL INTAKE — not public, ignored by Git
│   └── <category>/<event>/...
├── docs/
│   ├── CONTENT_MODEL.md
│   ├── DESIGN_PLAN.md
│   ├── UPLOAD_GUIDE.md
│   └── REPOSITORY_MAP.md
├── scripts/
│   ├── validate.py               JSON, reference, and public-boundary checks
│   ├── build.py                  Copies public inputs, generates readers, versions assets
│   ├── check_content_routes.py   Story/reader/evidence connection checks
│   ├── serve.py                  Local-only preview, preferred port 8876
│   └── add_event.py              Guided import of a new categorized occasion
├── tests/                        Isolated route and reader-build regression fixtures
└── dist/                         GENERATED WEBSITE — not edited or committed
```

Category and event folder names come from the content/media inventory. The diagram describes their position, not a requirement to create empty folders for every possible subject.

## The public boundary

Only `src/`, `content/`, and `assets/` become the website. The local original archive, provenance catalog, intake, working notes, project configuration, Git metadata, and these documents do not get copied to `dist/`.

When `content/site.json` declares `contentDirectories`, the build assembles its category/event arrays from those canonical directories in the generated copy only. It never rewrites the source records or index.

The dedicated experiences' data bundles are generated from `content/collections/cards.json` and `content/collections/pearls.json`. The source JavaScript stubs are intentionally empty of editorial data. A source-only file server is not the preview workflow; use `scripts/serve.py` to build and serve `dist/`.

`assets/` is therefore a publication boundary. A file placed there should be suitable for public delivery even if no current page links to it. The build deliberately copies the complete reviewed assets tree so valid optional media are available when a category opens.

## Dependencies and portability

The website runs in the browser without a package-manager build. The Python scripts use the standard library. Preparing new image derivatives may use Pillow or another image tool, but that is an editorial preparation step rather than a visitor or build dependency.

Keep URLs relative to the generated website root. Do not place a developer's absolute filesystem paths in public content. Keep local source paths in the ignored media catalog.

## Version control

Commit the website source, public content, reviewed public derivatives, scripts, workflow, and project documentation. Back up ignored originals separately. No remote repository is created and no live site is published by these scripts.

Large video originals belong in the archive. If the project later adopts shared object storage or Git LFS, document that decision and migration explicitly; do not convert existing collaborators to a hidden new storage dependency.
