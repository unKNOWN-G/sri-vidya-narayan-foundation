#!/usr/bin/env python3
"""Import reviewed event media without moving originals or inferring event dates."""
from __future__ import annotations

import argparse
from collections import Counter
from contextlib import contextmanager
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_LIMIT = 90 * 1024 * 1024
PHOTO_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.avif', '.heic', '.heif'}
VIDEO_EXT = {'.mp4', '.webm', '.mov', '.m4v', '.ogv'}
AUDIO_EXT = {'.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac', '.opus'}
SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
PRIVATE_PATH = re.compile(r'(?:/Users/|/home/|file://|[A-Za-z]:\\Users\\)')


def json_text(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def within(path, root):
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('An output path resolves outside the project; check directory symlinks.')
    cursor = path
    while cursor != root and cursor != cursor.parent:
        if cursor.is_symlink():
            raise ValueError('Output directories cannot be symlinks; keep the archive and public media separate.')
        cursor = cursor.parent
    return path


@contextmanager
def import_lock(root):
    folder = within(root / 'media/imports', root)
    folder.mkdir(parents=True, exist_ok=True)
    lock = folder / '.authoring.lock'
    try:
        descriptor = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise ValueError('Another import is running. If it stopped unexpectedly, remove media/imports/.authoring.lock after confirming no importer is active.') from exc
    try:
        with os.fdopen(descriptor, 'w') as stream:
            stream.write(str(os.getpid()) + '\n')
        yield
    finally:
        lock.unlink(missing_ok=True)


def derive_photo(source, large, thumb):
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise ValueError('Photo imports require Pillow: python3 -m pip install -r requirements-authoring.txt') from exc
    try:
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
            width, height = image.size
            resampling = getattr(Image, 'Resampling', Image).LANCZOS
            preview = image.copy()
            preview.thumbnail((1800, 1800), resampling)
            preview.save(large, 'WEBP', quality=88, method=4)
            small = image.copy()
            small.thumbnail((480, 480), resampling)
            small.save(thumb, 'WEBP', quality=80, method=4)
        return width, height
    except (OSError, ValueError) as exc:
        raise ValueError(f'Cannot read photo {source.name!r}. Check the file and install an appropriate decoder for HEIC/AVIF if needed.') from exc


def import_event(args, root=ROOT):
    root = Path(root).resolve()
    for name in ('category', 'id'):
        if not SLUG.fullmatch(getattr(args, name)):
            raise ValueError(f'--{name} must use lowercase words separated by hyphens.')
    if not args.title.strip():
        raise ValueError('--title cannot be empty.')
    for value in (args.title, args.description or '', args.location or ''):
        if PRIVATE_PATH.search(value):
            raise ValueError('Public titles and descriptions cannot contain local computer paths.')
    confirmed_date = date.fromisoformat(args.date) if args.date else None
    if args.date and confirmed_date.isoformat() != args.date:
        raise ValueError('--date must be YYYY-MM-DD.')
    if args.year is not None and not 1000 <= args.year <= 9999:
        raise ValueError('--year must be a four-digit year.')
    if confirmed_date and args.year is not None and confirmed_date.year != args.year:
        raise ValueError('--date and --year disagree.')
    category_file = within(root / 'content/categories' / (args.category + '.json'), root)
    if not category_file.is_file():
        raise ValueError(f'Unknown category {args.category!r}; use an existing content/categories/ ID.')
    original_category = category_file.read_bytes()
    category = json.loads(original_category)
    if category.get('id') != args.category:
        raise ValueError('Category filename and category ID disagree.')
    event_file = within(root / 'content/events' / (args.id + '.json'), root)
    for path in (root / 'content/events').glob('*.json'):
        if path == event_file or json.loads(path.read_text()).get('id') == args.id:
            raise ValueError(f'Event ID {args.id!r} already exists. Edit that event instead of overwriting it.')
    archive_final = within(root / 'media' / args.category / args.id, root)
    public_final = within(root / 'assets/media' / args.category / args.id, root)
    if archive_final.exists() or public_final.exists():
        raise ValueError('An archive or public-media directory already uses this event ID.')
    source = Path(args.input).expanduser().resolve()
    if not source.exists():
        raise ValueError('--input does not exist.')
    if source.is_dir() and root.is_relative_to(source):
        raise ValueError('Do not import the project or its parent directory. Select one event’s intake folder.')
    candidates = [source] if source.is_file() else sorted(source.rglob('*'))
    files = [f for f in candidates if f.is_file() and not f.is_symlink() and not f.name.startswith('.') and f.name != 'Thumbs.db']
    if not files:
        raise ValueError('No regular input files were found. Extract archives into an event folder first.')
    cover_source = None
    if args.cover:
        matches = [f for f in files if f.name == args.cover or str(f.relative_to(source if source.is_dir() else source.parent)) == args.cover]
        if len(matches) != 1 or matches[0].suffix.lower() not in PHOTO_EXT:
            raise ValueError('--cover must uniquely identify a photo inside --input.')
        cover_source = matches[0]
    if args.publish_category and not any(f.suffix.lower() in PHOTO_EXT for f in files):
        raise ValueError('--publish-category requires a real photograph that can become the category cover.')

    with import_lock(root), tempfile.TemporaryDirectory(prefix='.event-', dir=root / 'media/imports') as scratch:
        staging = Path(scratch)
        originals = staging / 'originals'
        public = staging / 'public'
        for subdir in ('photos', 'videos', 'audio', 'documents'):
            (originals / subdir).mkdir(parents=True)
        public.mkdir()
        counters = Counter()
        media = []
        provenance = []
        seen = {}
        cover = None
        first_photo = None
        warnings = []
        for item in files:
            suffix = item.suffix.lower()
            kind, folder = ('photo', 'photos') if suffix in PHOTO_EXT else ('video', 'videos') if suffix in VIDEO_EXT else ('audio', 'audio') if suffix in AUDIO_EXT else ('document', 'documents')
            digest = sha256(item)
            if digest in seen:
                provenance.append({'source_path': str(item), 'source_filename': item.name, 'sha256': digest, 'duplicate_of': seen[digest]})
                if item == cover_source:
                    cover = next((entry['src'] for entry in media if entry.get('originalHash') == digest), None)
                continue
            counters[kind] += 1
            stem = f'{kind}-{counters[kind]:02d}'
            original_relative = Path('media') / args.category / args.id / folder / (stem + suffix)
            original_copy = originals / folder / (stem + suffix)
            shutil.copy2(item, original_copy)
            if sha256(original_copy) != digest:
                raise ValueError(f'Copy verification failed for {item.name!r}.')
            seen[digest] = original_relative.as_posix()
            record = {'source_path': str(item), 'source_filename': item.name, 'sha256': digest, 'bytes': item.stat().st_size, 'local_original': original_relative.as_posix(), 'type': kind, 'public': False}
            entry = {'id': f'{args.category}-{args.id}-{stem}', 'type': kind, 'title': f'{args.title.strip()} — {kind} {counters[kind]:02d}', 'caption': args.description or args.title.strip(), 'alt': f'{args.title.strip()} — photograph {counters[kind]:02d}' if kind == 'photo' else args.title.strip(), 'src': '', 'thumb': ''}
            prefix = f'assets/media/{args.category}/{args.id}/'
            if kind == 'photo':
                width, height = derive_photo(original_copy, public / (stem + '.webp'), public / (stem + '.thumb.webp'))
                entry.update(src=prefix + stem + '.webp', thumb=prefix + stem + '.thumb.webp')
                record.update(width=width, height=height)
                first_photo = first_photo or entry['src']
                if item == cover_source:
                    cover = entry['src']
            elif kind in ('video', 'audio') or (suffix == '.pdf' and args.publish_documents):
                if item.stat().st_size <= PUBLIC_LIMIT:
                    shutil.copy2(original_copy, public / (stem + suffix))
                    entry['src'] = prefix + stem + suffix
                    if kind in ('video', 'audio'):
                        warnings.append(f'{stem + suffix}: copied without transcoding; check playback in target browsers.')
                else:
                    record['publication_note'] = 'Retained locally; exceeds 90 MiB public-file limit. Prepare a compressed web version or approved external hosting.'
            else:
                record['publication_note'] = 'Retained locally. Only already-reviewed PDF documents can be published with --publish-documents.'
            if entry['src']:
                record['public'] = True
                record['public_src'] = entry['src']
                entry['originalHash'] = digest  # Removed before writing public event JSON.
                media.append(entry)
            provenance.append(record)
        cover = cover or first_photo
        if args.publish_category and not cover:
            raise ValueError('--publish-category requires a successfully derived real photograph.')
        for entry in media:
            entry.pop('originalHash', None)
        counts = Counter({'photo': 'photos', 'video': 'videos', 'audio': 'audio', 'document': 'documents'}[m['type']] for m in media)
        event = {'id': args.id, 'category': args.category, 'title': args.title.strip(), 'location': args.location or None, 'date': confirmed_date.isoformat() if confirmed_date else None, 'year': confirmed_date.year if confirmed_date else args.year, 'description': args.description or '', 'cover': cover, 'credit': 'Original media shared by the foundation.', 'note': '', 'published': bool(media), 'counts': dict(counts), 'media': media}
        category['eventIds'] = list(dict.fromkeys(category.get('eventIds', []) + ([args.id] if media else [])))
        if cover and not category.get('cover'):
            category['cover'] = cover
            category['coverAlt'] = args.title.strip()
        if args.publish_category:
            category['published'] = True
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        receipt = {'event': args.id, 'category': args.category, 'imported_at_utc': stamp, 'input_path': str(source), 'confirmed_date': event['date'], 'confirmed_year': event['year'], 'public_documents_explicitly_reviewed': bool(args.publish_documents), 'published_category': bool(args.publish_category), 'items': provenance, 'warnings': warnings, 'draft_unlisted': not bool(media)}
        result = {'event': event, 'archive': archive_final.relative_to(root).as_posix(), 'receipt': f'media/imports/{args.id}-{stamp}.json', 'warnings': warnings, 'dry_run': args.dry_run}
        if args.dry_run:
            return result
        if category_file.read_bytes() != original_category:
            raise ValueError('Category changed during import; retry against its current content.')
        archive_final.parent.mkdir(parents=True, exist_ok=True)
        public_final.parent.mkdir(parents=True, exist_ok=True)
        event_file.parent.mkdir(parents=True, exist_ok=True)
        receipt_file = root / result['receipt']
        category_temp = category_file.with_suffix('.import-tmp')
        committed = []
        try:
            shutil.move(str(originals), str(archive_final)); committed.append(archive_final)
            shutil.move(str(public), str(public_final)); committed.append(public_final)
            with event_file.open('x', encoding='utf-8') as stream:
                stream.write(json_text(event))
            committed.append(event_file)
            receipt_file.write_text(json_text(receipt), encoding='utf-8'); committed.append(receipt_file)
            category_temp.write_text(json_text(category), encoding='utf-8')
            os.replace(category_temp, category_file)
        except Exception:
            category_temp.unlink(missing_ok=True)
            for created in reversed(committed):
                shutil.rmtree(created) if created.is_dir() else created.unlink(missing_ok=True)
            raise
        return result


def parser():
    cli = argparse.ArgumentParser(description=__doc__)
    for option in ('category', 'id', 'title', 'input'):
        cli.add_argument('--' + option, required=True)
    cli.add_argument('--description', default='', help='Reviewed public description; no private details.')
    cli.add_argument('--location', default='', help='Confirmed place; never inferred from a filename.')
    cli.add_argument('--date', help='Confirmed event date, YYYY-MM-DD.')
    cli.add_argument('--year', type=int, help='Confirmed event year when no exact date is known.')
    cli.add_argument('--cover', help='Unique relative photo filename inside the input folder; default is the first photo.')
    cli.add_argument('--publish-documents', action='store_true', help='Confirm input PDFs are already reviewed for public release; other document types remain local.')
    cli.add_argument('--publish-category', action='store_true', help='Enable this category only when this import provides a real photo cover.')
    cli.add_argument('--dry-run', action='store_true', help='Prepare and check in temporary storage without adding an event, derivatives or archive.')
    return cli


def main():
    args = parser().parse_args()
    try:
        result = import_event(args)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f'Import failed: {exc}', file=sys.stderr)
        return 1
    event = result['event']
    label = 'Dry run' if result['dry_run'] else 'Imported'
    print(f'{label}: {event["id"]} — {len(event["media"])} public media item(s).')
    if not result['dry_run']:
        print(f'Originals: {result["archive"]}/')
        print(f'Local import receipt: {result["receipt"]}')
    if not event['published']:
        print('No publishable media: preserved as an unlisted draft. Review the local import receipt.')
    for warning in result['warnings']:
        print('NOTE:', warning)
    print('Next: python3 scripts/validate.py && python3 scripts/build.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
