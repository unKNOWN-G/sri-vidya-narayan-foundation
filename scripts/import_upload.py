#!/usr/bin/env python3
"""Import a confirmed private photo batch into the existing site's content model."""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import date
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from types import SimpleNamespace

from add_event import ROOT, derive_photo, import_event, import_lock, json_text

CATEGORIES = {'his-holiness','education','spiritual-life','vedic-learning','annadanam','healthcare'}
UUID = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
HASH = re.compile(r'^[a-f0-9]{64}$')
SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
MAX_PHOTO = 500000


def validate_batch(batch):
    if batch.get('confirmed') is not True or not UUID.fullmatch(str(batch.get('id',''))):
        raise ValueError('An explicitly confirmed, identified update is required.')
    if batch.get('category') not in CATEGORIES:
        raise ValueError('Unsupported photo section.')
    for key,limit,required in (('title',150,True),('caption',1500,True),('location',150,False)):
        value=batch.get(key,'')
        if not isinstance(value,str) or len(value)>limit or (required and not value.strip()) or re.search(r'[\x00-\x08\x0b-\x1f]|/Users/|/home/|file://',value):
            raise ValueError('Invalid public '+key+'.')
    if batch.get('date'):
        if date.fromisoformat(batch['date']).isoformat()!=batch['date']:
            raise ValueError('Invalid confirmed occasion date.')
    if batch.get('target') and not SLUG.fullmatch(batch['target']):
        raise ValueError('Invalid existing occasion ID.')
    photos=batch.get('photos')
    if not isinstance(photos,list) or not 1<=len(photos)<=20:
        raise ValueError('An update needs 1–20 photographs.')
    ids=[p.get('id','') for p in photos]
    if len(ids)!=len(set(ids)) or not all(HASH.fullmatch(i) for i in ids) or batch.get('cover') not in ids:
        raise ValueError('Invalid photo manifest or cover.')
    if any(not isinstance(p.get('bytes'),int) or not 12<=p['bytes']<=MAX_PHOTO for p in photos) or sum(p['bytes'] for p in photos)>8000000:
        raise ValueError('Photo batch exceeds its size limits.')
    return batch


def import_batch(batch, photo_directory, root=ROOT):
    validate_batch(batch)
    root=Path(root).resolve();photo_directory=Path(photo_directory).resolve()
    category_file=root/'content/categories'/(batch['category']+'.json')
    category=json.loads(category_file.read_text())
    if category.get('published') is False:
        raise ValueError('This section is not published. Review it before adding uploads.')
    # A retried workflow must never create another occasion or another copy of its photos.
    for path in (root/'content/events').glob('*.json'):
        record=json.loads(path.read_text())
        if batch['id'] in record.get('uploadBatchIds',[]):
            return {'id':record['id'],'alreadyImported':True,'added':0}
    for item in batch['photos']:
        source=photo_directory/(item['id']+'.webp')
        if not source.is_file() or source.is_symlink() or source.stat().st_size!=item['bytes'] or hashlib.sha256(source.read_bytes()).hexdigest()!=item['id']:
            raise ValueError('Photo verification failed.')
        from PIL import Image
        with Image.open(source) as opened:
            if opened.format!='WEBP' or max(opened.size)>1800 or min(opened.size)<1:
                raise ValueError('A photo is not a prepared website photograph.')
            opened.verify()
    if batch.get('target'):
        return append_batch(batch,photo_directory,root)
    identifier='upload-'+batch['id']
    profiles_path=root/'content/collections/education-profiles.json'
    if batch['category']=='education':
        profiles=json.loads(profiles_path.read_text())
        if any(p.get('id')==identifier for p in profiles):
            raise ValueError('An existing school profile uses this update ID.')
    with tempfile.TemporaryDirectory(prefix='upload-import-') as temporary:
        sources=Path(temporary)
        names={}
        for i,item in enumerate(batch['photos'],1):
            name=f'photo-{i:02d}.webp';names[item['id']]=name
            shutil.copyfile(photo_directory/(item['id']+'.webp'),sources/name)
        args=SimpleNamespace(category=batch['category'],id=identifier,title=batch['title'].strip(),description=batch['caption'].strip(),location=batch.get('location','').strip(),date=batch.get('date'),year=None,input=str(sources),cover=names[batch['cover']],publish_documents=False,publish_category=False,dry_run=False)
        result=import_event(args,root)
    event=result['event'];event['uploadBatchIds']=[batch['id']]
    for entry,item in zip(event['media'],batch['photos']):entry['uploadHash']=item['id']
    (root/'content/events'/(identifier+'.json')).write_text(json_text(event))
    if batch['category']=='education':
        # Caption is supplied verbatim. No donation or financial amount is inferred.
        profiles.append({'id':identifier,'eventId':identifier,'title':batch['title'].strip(),'recordIds':[],
            'amountLabel':'Shared occasion','contributionText':batch['caption'].strip()[:100], 'description':batch['caption'].strip()})
        profiles_path.write_text(json_text(profiles))
    return {'id':identifier,'alreadyImported':False,'added':len(event['media'])}


def append_batch(batch,directory,root):
    path=root/'content/events'/(batch['target']+'.json')
    if not path.is_file():raise ValueError('The existing occasion was not found.')
    original=path.read_bytes();event=json.loads(original)
    if event.get('category')!=batch['category'] or event.get('published') is False or event.get('presentation')=='service-story':
        raise ValueError('Photographs cannot be attached to that occasion.')
    hashes={m.get('uploadHash') for m in event.get('media',[])}
    selected=[p for p in batch['photos'] if p['id'] not in hashes]
    final=root/'assets/media'/batch['category']/batch['target']/'updates'/batch['id']
    if final.exists():raise ValueError('An output directory already exists for this update.')
    with import_lock(root),tempfile.TemporaryDirectory(prefix='.update-',dir=root/'media/imports') as temporary:
        staging=Path(temporary)
        for n,item in enumerate(selected,1):
            stem=f'photo-{n:02d}';derive_photo(directory/(item['id']+'.webp'),staging/(stem+'.webp'),staging/(stem+'.thumb.webp'))
            prefix=final.relative_to(root).as_posix()+'/'
            event.setdefault('media',[]).append({'id':f'{batch["target"]}-{batch["id"]}-{stem}','type':'photo','title':batch['title'].strip()+' — photograph '+str(n),'alt':batch['title'].strip()+' — photograph '+str(n),'caption':batch['caption'].strip(),'src':prefix+stem+'.webp','thumb':prefix+stem+'.thumb.webp','uploadHash':item['id']})
        event.setdefault('uploadBatchIds',[]).append(batch['id'])
        labels={'photo':'photos','video':'videos','audio':'audio','document':'documents','youtube':'youtube'}
        event['counts']=dict(Counter(labels.get(m['type'],m['type']) for m in event['media']))
        if path.read_bytes()!=original:raise ValueError('The occasion changed during import. Retry against the latest content.')
        temporary_path=path.with_suffix('.upload-tmp')
        try:
            if selected:final.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(staging),str(final))
            temporary_path.write_text(json_text(event));os.replace(temporary_path,path)
        except Exception:
            temporary_path.unlink(missing_ok=True)
            if final.exists():shutil.rmtree(final)
            raise
    return {'id':event['id'],'alreadyImported':False,'added':len(selected)}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise ValueError('Unexpected redirect from the private upload service.')


def backend(path, method='GET', payload=None):
    base=os.environ.get('UPLOADER_URL','').rstrip('/')
    token=os.environ.get('UPLOADER_INTERNAL_TOKEN','')
    parsed=urllib.parse.urlsplit(base)
    if parsed.scheme!='https' or parsed.username or parsed.password or parsed.query or parsed.fragment or not parsed.hostname or not token or len(token)<32:
        raise ValueError('The private uploader connection is not configured.')
    headers={'Authorization':'Bearer '+token,'Accept':'application/json'}
    data=None
    if payload is not None:headers['Content-Type']='application/json';data=json.dumps(payload).encode()
    request=urllib.request.Request(base+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.build_opener(NoRedirect).open(request,timeout=60) as response:
            content=response.read(MAX_PHOTO+20000)
            if len(content)>MAX_PHOTO+10000:raise ValueError('The upload service returned an oversized response.')
            return content
    except urllib.error.HTTPError as exc:
        raise ValueError('The private uploader request failed (HTTP '+str(exc.code)+').') from None
    except urllib.error.URLError:
        raise ValueError('The private uploader could not be reached.') from None


def main():
    cli=argparse.ArgumentParser(description=__doc__);cli.add_argument('--batch-id',required=True);cli.add_argument('--complete',choices=('success','failure'));cli.add_argument('--commit');args=cli.parse_args()
    if not UUID.fullmatch(args.batch_id):raise ValueError('Invalid update ID.')
    run=os.environ.get('GITHUB_RUN_ID','')
    if not run.isdigit():raise ValueError('This operation requires a GitHub workflow run.')
    base='/internal/batches/'+args.batch_id
    if args.complete:
        backend(base+'/complete','POST',{'run_id':run,'success':args.complete=='success','commit':args.commit})
        print('Publishing status recorded.');return
    backend(base+'/claim','POST',{'run_id':run})
    batch=validate_batch(json.loads(backend(base)))
    if batch['id']!=args.batch_id:raise ValueError('The update ID did not match.')
    with tempfile.TemporaryDirectory(prefix='website-upload-') as temporary:
        directory=Path(temporary)
        for p in batch['photos']:
            data=backend(base+'/photos/'+p['id'])
            if len(data)!=p['bytes'] or hashlib.sha256(data).hexdigest()!=p['id']:raise ValueError('Photo download verification failed.')
            (directory/(p['id']+'.webp')).write_bytes(data)
        result=import_batch(batch,directory)
    print('Photo update prepared: '+str(result['added'])+' new photographs.')


if __name__=='__main__':
    try:main()
    except (ValueError,OSError,json.JSONDecodeError) as exc:
        print('Upload import stopped: '+str(exc),file=sys.stderr);sys.exit(1)
