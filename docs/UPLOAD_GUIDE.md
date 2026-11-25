# Adding photographs, video, audio, and documents

This is an editorial file workflow for the project owner or a future content maintainer. The website does not currently provide a public upload form or administration panel.

## Guided import

Put the files for one occasion in an intake folder, then use the import command:

```sh
python3 -m pip install -r requirements-authoring.txt
python3 scripts/add_event.py \
  --category education \
  --id school-visit-example \
  --title "A visit with students" \
  --input incoming/my-visit \
  --location "Confirmed institution and place" \
  --dry-run
```

Review the dry-run output. Remove `--dry-run` to perform the import. Add `--date YYYY-MM-DD` or `--year YYYY` only when confirmed; `--description` and `--cover relative-photo-name.jpeg` can supply the occasion context and preferred cover.

The command copies unchanged originals into the ignored archive, prepares WebP photo derivatives and previews, and writes one canonical event record. It rejects existing event IDs/output folders instead of overwriting them. Public audio/video are capped at 90 MiB by this authoring tool; larger sources remain in the archive for delivery preparation. PDFs remain local unless `--publish-documents` explicitly identifies them as already reviewed for public delivery.

A category's publication state stays unchanged by default. For a draft category such as music, `--publish-category` can publish it only when a real photograph/cover was imported. An archive-only import remains unlisted. The original audit catalog stays unchanged; each import receives a local receipt under `media/imports/`.

See [the worked event example](NEW_EVENT_EXAMPLE.md). The optional Pillow dependency supports media authoring only; the website build remains Python-standard-library-only.

## Start with one occasion

Create a folder in the ignored local intake area, for example:

```text
incoming/
  education/
    madanapalle-sgdc-visit/
      photos/
      videos/
      audio/
      documents/
      notes.txt
```

In `notes.txt`, record the event name, category, institution or venue, place, a confirmed date if known, what Swamiji did, who supplied the material, and any caption corrections. Leave unknown information blank. Do not derive an event date from a WhatsApp filename or a camera clock without confirmation.

If a new upload belongs to an existing visit, use the existing event ID. A new upload is not automatically a new event.

## Preserve the originals

Copy the supplied files unchanged to the corresponding archive folder:

```text
media/
  education/
    madanapalle-sgdc-visit/
      photos/
      videos/
      audio/
      documents/
```

Use the local catalog to retain the supplied filename, checksum, source path, dimensions, size, and identification notes. Check hashes before importing a repeated upload so one photograph or document does not become several apparent events.

The original archive is ignored by Git and excluded from `dist/`. Back it up separately. The build and source repository cannot replace that archival backup.

## Prepare the public files

Place reviewed derivatives in:

```text
assets/media/<category>/<event>/
```

Use concise stable names such as `photo-01.webp`, `photo-01.thumb.webp`, `video-01.mp4`, `video-01-poster.webp`, and `school-acknowledgement.pdf`. Keep the mapping to the original filename in the local catalog.

- **Photographs:** correct display orientation, create a web-size image and a smaller preview, and retain enough resolution for the viewer. Do not redraw or fabricate documentary content. Avoid embedding location metadata in public derivatives.
- **Video:** retain the original locally. Publish an appropriate web version and a genuine poster image, or use a supplied external video URL. Review large files before adding them to the source repository.
- **Audio:** preserve the source and publish an appropriate web version with an accurate title and occasion. Do not attach a speaker's name based only on a filename.
- **Documents:** publish only material suitable for public reading. Preserve the entire supplied page or photograph. Mask private fields in place; do not crop or rearrange a receipt to hide them. Document photos can be displayed as supplied rather than guessed transcriptions.
- **Book covers and message artwork:** preserve their aspect ratio and supplied identity. Do not treat a promotional design as documentary evidence of an event.

The existing media inventory records public `src` and optional `thumb` paths. Keep the same pattern for new records. Public paths start with `assets/` and remain relative so GitHub Pages project paths work.

## Add it to the website

1. Add or update the local catalog record using the existing schema.
2. Add the reviewed event/media information to `content/events/<event-id>.json`, and update the relevant record in `content/categories/` if needed. Reading collections belong in `content/collections/`.
3. Assign it to an existing category and choose an accurate cover.
4. Write a short caption that explains the moment. Add alt text that describes what is visible.
5. Keep public content free of local computer paths, private source links, personal addresses, signatures, bank information, student records, and private health details.

The public content model can include multiple media types under one occasion. Do not split one visit into unrelated photo, video, and audio events merely because the file extensions differ.

## Preview and check

```sh
python3 scripts/validate.py
python3 scripts/build.py
python3 scripts/serve.py --port 8876
```

Open the new occasion from its category. Check its title, photo count, cover, captions, full image view, and any clip or document that was added. Check the phone layout and keyboard access if the UI changed.

After that review, stage the changed source, reviewed public content, and public derivatives. Keep the original archive and local catalog out of the public commit. A successful local build is ready for review; it does not upload or publish the site.

## A compact upload note

For future additions, supplying these fields with the files reduces searching and token use:

```text
Category:
Existing event ID, or new occasion name:
Institution/venue and place:
Confirmed event date, if known:
What Swamiji did:
Preferred cover photograph:
People who may be named in captions:
Public documents or approved excerpts:
Corrections to existing material:
```
