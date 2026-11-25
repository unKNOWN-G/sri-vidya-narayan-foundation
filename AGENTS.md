# Working on this project

Read `PROJECT.json`, `README.md`, and the relevant document in `docs/` before making structural changes. Follow the user's current instructions over repository conventions.

## Ownership of files

- Edit the website in `src/` and its content in `content/`.
- Use `content/site.json` as the public interface between content and presentation. Keep event IDs stable.
- Store reviewed public derivatives in `assets/`. Store unchanged originals and the local source catalog in `media/`; they are intentionally ignored by Git and excluded from the public build.
- Do not edit `dist/` by hand. Rebuild it.
- Do not modify the earlier website or its server on port 8765 as a side effect of working here.

## Content and media

Use real supplied photographs for subject cards whenever suitable media exists. Do not invent a concert, medical camp, donation, testimonial, visit date, quotation, or programme outcome to fill a design slot. If a source is incomplete, keep the claim narrow and record the gap in editorial notes.

Keep school establishment, visits, funding, and current operation distinct. A photograph of an institution does not establish a donation amount. The foundation's start date is distinct from Swamiji's earlier service. Paraphrased teachings must not be presented as direct quotations.

Never publish source documents containing bank account details, private addresses, personal contact details, signatures, private health information, or identifiable student records. Reuse only reviewed public excerpts. Keep source filenames and paths in the local catalog, not in public content JSON.

## Experience

Keep the opening experience focused on discovery in a fixed scene, with neighbouring content visibly available. Support touch, keyboard, visible focus, readable text, pause controls, and reduced-motion settings. Automatic motion must not make navigation or reading difficult. Use the native pointer; do not conceal it behind a decorative cursor.

Prefer meaningful captions and category names to extra UI. Preserve real photo proportions in detail viewers. Videos and audio play only after an explicit user action.

## Verification

Run `python3 scripts/validate.py`, then `python3 scripts/build.py`. For visual changes, check the built site in the browser at desktop and phone sizes. Check one real route into each changed content type. Keep browser checks focused on the changed behaviour rather than repeating an entire audit.

Publishing a remote site, changing access, sending communications, and deleting original material are separate operations. A local build or commit does not imply that publication occurred.

## Communication

Report the outcome, what was checked, and any material limitation. The user requests a token-use report for every query: provide the actual count if available, otherwise clearly label an estimate or state that exact usage is unavailable. If usage exceeds 10,000 tokens, explain how to reduce the next request's overhead and when a fresh chat would help. Never present an estimated count as measured telemetry.
