# Add one occasion with its original media

The importer copies originals into the ignored local archive and prepares public media under the same stable category/event IDs. It does not move or alter source files. Normal building requires only Python; photograph ingestion additionally uses Pillow:

```sh
python3 -m pip install -r requirements-authoring.txt
```

Put one occasion's files in a folder such as `incoming/sgdc-new-visit/`. Extract ZIP archives first. Photos, video, audio and documents may be mixed in the same folder or its subfolders.

```sh
python3 scripts/add_event.py \
  --category education \
  --id sgdc-new-visit \
  --title "A visit with students at SGDC" \
  --input incoming/sgdc-new-visit \
  --location "Madanapalle, Andhra Pradesh" \
  --description "Swamiji addressing a gathering of students at Shri Gnanambica Degree College." \
  --cover chosen-photograph.jpeg
```

This example intentionally has no date. Add `--date 2026-11-25` only if that exact event date is confirmed, or use `--year 2026` if only the year is known. The importer never reads a WhatsApp sharing date as an event date. Conflicting date/year options fail.

A `--dry-run` prepares the same media in temporary storage and prints the proposed public count without saving an event, archive, or derivatives. Omit it to save the import. Existing event IDs or media folders are never overwritten.

For manual authoring, start from `docs/templates/event.json`; it is kept outside public content.

## What is written

```text
content/events/sgdc-new-visit.json
content/categories/education.json       # Adds the event ID
assets/media/education/sgdc-new-visit/
  photo-01.webp
  photo-01.thumb.webp
  video-01.mp4                         # When supplied and eligible
media/education/sgdc-new-visit/         # Unchanged originals; ignored by Git
  photos/
  videos/
  audio/
  documents/
media/imports/sgdc-new-visit-<time>.json # Local receipt; ignored by Git
```

Images are oriented from EXIF, resized to at most 1800 px, and accompanied by 480 px thumbnails. Source metadata is not copied into the public images. The importer uses ordinary image resizing, never AI reconstruction. Exact duplicates within the input share one stored original and one public derivative; the receipt retains their original filenames and hashes.

Audio/video up to 90 MiB are copied without transcoding. Larger files remain in the local archive with a note to prepare a smaller web version or approved external hosting. Check actual playback: a copied MOV/HEVC file is not guaranteed to work in every browser. The script does not invent poster images.

Documents stay local by default. Use `--publish-documents` only for PDFs already reviewed for public release. Other document types remain local even with that flag. Do not use it on original cheques, private contact details, student records, signatures, or private medical information; prepare an approved excerpt first. A receipt records that document publication was explicitly selected.

If nothing can be published, the event is saved as `published: false` and is not added to the category's `eventIds`; its original files and import receipt still exist locally. It remains unlisted until reviewed public media are provided manually. The existing full media catalog is not rewritten: the import receipt records provenance for the new occasion.

## Enable music only when a real photograph is available

```sh
python3 scripts/add_event.py \
  --category music \
  --id veena-gathering \
  --title "Music and devotion" \
  --input incoming/veena-gathering \
  --publish-category
```

`--publish-category` requires a successfully processed real photo. Without it, the category's publication state remains unchanged. The new event's photo can become a previously empty category cover; an existing cover is preserved. Review the caption, setting and identity yourself rather than deriving a concert or musician's name from the filename.

## Finish the review

Edit the generated event's generic captions and alt text to describe the actual moments. Add only confirmed facts. Then run:

```sh
python3 scripts/validate.py
python3 scripts/build.py
python3 scripts/serve.py --port 8876
```

The build assembles the canonical category and event files into `content/site.json`. Check the new occasion, all media, and the phone layout before committing the reviewed source and assets. No upload to GitHub or publication occurs when this script runs. The ignored `media/` archive needs its own backup.
