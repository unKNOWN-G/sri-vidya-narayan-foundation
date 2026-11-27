#!/usr/bin/env python3
"""Publish one explicitly approved WhatsApp event using an isolated checkout."""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import date
import fcntl
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid

ROOT=Path(__file__).resolve().parents[1]
STATE=ROOT/'private/whatsapp'
ORIGINALS=ROOT/'media/whatsapp/originals'
CATEGORIES={'his-holiness','teachings','spiritual-life','vedic-learning','education','annadanam','healthcare'}
REPO='unKNOWN-G/sri-vidya-narayan-foundation'
SITE='https://unknown-g.github.io/sri-vidya-narayan-foundation/'
KINDS={'photo':'photos','video':'videos','audio':'audio','youtube':'youtube','message':'messages'}
UUID=re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')

def run(args,cwd=ROOT):
    p=subprocess.run([str(x) for x in args],cwd=cwd,capture_output=True,text=True)
    if p.returncode:
        name=str(args[0]).split('/')[-1]
        if 'ffmpeg' in name:raise ValueError('One recording could not be prepared. Send it as MP4 video, MP3 audio or a YouTube link instead.')
        if name.startswith('python'):raise ValueError('The website checks did not pass. Your update is saved for review.')
        raise ValueError('The website connection needs attention. Check the Mac internet connection and GitHub sign-in, then send RETRY.')
    return p.stdout.strip()

def atomic(path,data):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.chmod(0o600);os.replace(tmp,path)

def public_text(value,limit,required=True):
    if not isinstance(value,str) or len(value)>limit or (required and not value.strip()) or re.search(r'[\x00-\x08\x0b-\x1f]|/Users/|/home/|file://',value):raise ValueError('Check the public title and caption.')
    return value.strip()

def validate_job(job):
    if not UUID.fullmatch(str(job.get('id',''))) or job.get('confirmed') is not True:raise ValueError('An explicit PUBLISH confirmation is required.')
    if job.get('category') not in CATEGORIES:raise ValueError('Unknown section.')
    revision=job.get('revisionOf')
    if revision and (not isinstance(revision,dict) or not UUID.fullmatch(str(revision.get('jobId',''))) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',str(revision.get('eventId','')))):raise ValueError('Invalid upload revision.')
    public_text(job.get('title'),150);public_text(job.get('caption'),1500)
    if job.get('date') and date.fromisoformat(job['date']).isoformat()!=job['date']:raise ValueError('Use a confirmed occasion date.')
    if job.get('target') and not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',job['target']):raise ValueError('Invalid occasion.')
    if not isinstance(job.get('items'),list) or not 1<=len(job['items'])<=200:raise ValueError('Use 1–200 items in one event.')
    for item in job['items']:
        kind=item.get('kind')
        if kind not in KINDS:raise ValueError('Unsupported media type.')
        if kind in ('photo','video','audio') and not re.fullmatch(r'[a-f0-9]{64}\.bin',item.get('file','')):raise ValueError('Invalid incoming file.')
        if kind=='youtube' and not re.fullmatch(r'[A-Za-z0-9_-]{11}',item.get('youtubeId','')):raise ValueError('Invalid YouTube video.')
        if kind=='message':public_text(item.get('text'),20000)
    return job

def photo(source,destination):
    from PIL import Image,ImageOps
    Image.MAX_IMAGE_PIXELS=40000000
    with Image.open(source) as image:
        image=ImageOps.exif_transpose(image).convert('RGB');image.thumbnail((1600,1600))
        for edge in (1600,1200,900):
            image.thumbnail((edge,edge))
            for quality in (88,76,62,45):
                image.save(destination,'WEBP',quality=quality,method=4)
                if destination.stat().st_size<=500000:return
    raise ValueError('A photograph could not be prepared within website limits.')

def transcode(source,destination,kind,poster=None):
    import imageio_ffmpeg
    ff=imageio_ffmpeg.get_ffmpeg_exe()
    args=[ff,'-nostdin','-hide_banner','-loglevel','error','-y','-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,webm,ogg,mp3,wav,aac,flac,amr,asf,aiff,ac3,avi,mpeg,mpegts','-i',source,'-map_metadata','-1','-map_chapters','-1']
    if kind=='audio':args+=['-vn','-c:a','aac','-b:a','128k']
    else:args+=['-map','0:v:0','-map','0:a:0?','-vf',"scale='min(1280,iw)':-2",'-c:v','libx264','-preset','fast','-crf','27','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k']
    run(args+['-movflags','+faststart',destination])
    if destination.stat().st_size>85*1024*1024:raise ValueError('A recording is too long for free website storage. Upload it to YouTube and forward its link instead.')
    if poster:
        run([ff,'-nostdin','-hide_banner','-loglevel','error','-y','-i',destination,'-frames:v','1','-vf',"scale='min(900,iw)':-2",poster])

def prepare(job,directory,originals=ORIGINALS):
    validate_job(job);directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    items=[];seen=set()
    for n,item in enumerate(job['items'],1):
        kind=item['kind'];name='item-'+str(n).zfill(3)
        entry={'type':kind,'title':job['title']+' — '+({'photo':'photograph','video':'video','audio':'recording','youtube':'YouTube recording','message':'message'}[kind])+' '+str(n),'caption':public_text(item.get('caption') or job['caption'],1500)}
        if kind in ('photo','video','audio'):
            source=(Path(originals)/item['file'])
            if source.is_symlink() or not source.is_file() or source.resolve().parent!=Path(originals).resolve():raise ValueError('A private original is unavailable.')
            if kind=='photo':
                output=directory/(name+'.webp');photo(source,output)
                thumb=directory/(name+'.thumb.webp');photo(output,thumb)
                from PIL import Image
                with Image.open(thumb) as im:im.thumbnail((420,420));im.save(thumb,'WEBP',quality=75)
                entry.update(src=output.name,thumb=thumb.name,alt=entry['title'])
            else:
                output=directory/(name+('.m4a' if kind=='audio' else '.mp4'))
                poster=directory/(name+'.poster.webp') if kind=='video' else None
                transcode(source,output,kind,poster)
                entry['src']=output.name
                if poster:entry['poster']=poster.name
            digest=hashlib.sha256(output.read_bytes()).hexdigest()
        elif kind=='youtube':
            entry.update(url='https://www.youtube.com/watch?v='+item['youtubeId'],poster='https://i.ytimg.com/vi/'+item['youtubeId']+'/hqdefault.jpg')
            digest=hashlib.sha256(entry['url'].encode()).hexdigest()
        else:
            text=public_text(item['text'],20000);output=directory/(name+'.html')
            output.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(job['title'])+'</title><style>body{margin:0;background:#f8f2e5;color:#33291f;font:clamp(18px,3vw,23px)/1.8 Georgia,serif}main{max-width:42rem;margin:5vh auto;padding:5vw}h1{line-height:1.2}article{white-space:pre-wrap;overflow-wrap:anywhere}small{font:14px system-ui;color:#746555}</style><main><small>MESSAGE SHARED BY THE FOUNDATION</small><h1>'+html.escape(job['title'])+'</h1><article>'+html.escape(text)+'</article></main></html>')
            entry.update(src=output.name,text=text);digest=hashlib.sha256(text.encode()).hexdigest()
        if digest not in seen:entry['uploadHash']=digest;seen.add(digest);items.append(entry)
    return items

def import_prepared(job,prepared,items,root):
    root=Path(root);validate_job(job)
    category_path=root/'content/categories'/(job['category']+'.json');category=json.loads(category_path.read_text())
    if category.get('published') is False:raise ValueError('This section is not published.')
    for p in (root/'content/events').glob('*.json'):
        event=json.loads(p.read_text())
        if job['id'] in event.get('whatsappJobIds',[]):return {'eventId':event['id'],'added':0}
    target=job.get('target')
    if not target:
        matches=[json.loads(p.read_text()) for p in (root/'content/events').glob('*.json')]
        matches=[e for e in matches if e.get('category')==job['category'] and e.get('title','').casefold()==job['title'].casefold()]
        if len(matches)>1:raise ValueError('Select the existing event from the WhatsApp list; more than one event has this name.')
        if matches:target=matches[0]['id']
    event_id=target or 'whatsapp-'+job['id']
    path=root/'content/events'/(event_id+'.json')
    if target:
        if not path.is_file():raise ValueError('That occasion is no longer available.')
        event=json.loads(path.read_text())
        if event.get('category')!=job['category'] or event.get('published') is False or event.get('presentation')=='service-story':raise ValueError('Choose an ordinary occasion in the same section; receipts need a separate review.')
    else:
        if path.exists():raise ValueError('That event identifier is already in use.')
        event={'id':event_id,'category':job['category'],'title':job['title'],'description':job['caption'],'location':job.get('location',''),'date':job.get('date'),'year':None,'credit':'Media and messages shared and approved by the foundation.','note':'','media':[],'cover':category['cover']}
    prefix='assets/media/'+job['category']+'/'+event_id+'/whatsapp/'+job['id']+'/'
    known={m.get('uploadHash') for m in event['media']};added=[]
    for n,item in enumerate(items):
        if item['uploadHash'] in known:continue
        entry=dict(item);entry['id']=event_id+'-'+job['id']+'-'+str(n)
        for field in ('src','thumb','poster'):
            if entry.get(field) and not entry[field].startswith('https://'):
                source=Path(prepared)/entry[field];destination=root/(prefix+entry[field]);destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination);entry[field]=prefix+entry[field]
        event['media'].append(entry);known.add(entry['uploadHash']);added.append(entry)
    if not target and added:
        image=next((m['src'] for m in added if m['type']=='photo'),None) or next((m.get('poster') for m in added if m.get('poster')),None)
        if image:event['cover']=image
    event['counts']=dict(Counter(KINDS[m['type']] if m['type'] in KINDS else 'documents' for m in event['media']))
    event.setdefault('whatsappJobIds',[]).append(job['id']);path.write_text(json.dumps(event,ensure_ascii=False,indent=2)+'\n')
    if not target:
        category.setdefault('eventIds',[]).append(event_id);category_path.write_text(json.dumps(category,ensure_ascii=False,indent=2)+'\n')
        if job['category']=='education':
            profiles_path=root/'content/collections/education-profiles.json';profiles=json.loads(profiles_path.read_text());profiles.append({'id':event_id,'eventId':event_id,'title':job['title'],'recordIds':[],'amountLabel':'Shared occasion','contributionText':job['caption'][:100],'description':job['caption']});profiles_path.write_text(json.dumps(profiles,ensure_ascii=False,indent=2)+'\n')
    return {'eventId':event_id,'added':len(added)}

def revise_event(job,root):
    """Correct this upload in place; never overwrite another upload's media."""
    validate_job(job);root=Path(root);revision=job['revisionOf'];event_id=revision['eventId']
    if job.get('target') not in (None,event_id):raise ValueError('An edit keeps the existing page. Change its name rather than selecting another event.')
    path=root/'content/events'/(event_id+'.json')
    if not path.is_file():raise ValueError('The original event is no longer available.')
    event=json.loads(path.read_text());old_category=event['category'];old_date=event.get('date')
    if event.get('published') is False:raise ValueError('The original event is not public. Review it before editing through WhatsApp.')
    if job['id'] in event.get('whatsappJobIds',[]):return {'eventId':event_id,'added':0,'oldCategory':old_category}
    owned=[m for m in event['media'] if m.get('id','').startswith(event_id+'-'+revision['jobId']+'-')]
    if not owned or revision['jobId'] not in event.get('whatsappJobIds',[]):raise ValueError('This event does not contain that upload. No changes were made.')
    whole=len(owned)==len(event['media'])
    if not whole and (job['category']!=old_category or job['title']!=event['title'] or job.get('date')!=event.get('date')):raise ValueError('This set was added to a shared event. Its caption can be edited; moving or renaming the whole event needs a separate review.')
    new_category_path=root/'content/categories'/(job['category']+'.json');new_category=json.loads(new_category_path.read_text())
    if new_category.get('published') is False:raise ValueError('That section is not published.')
    profile_path=root/'content/collections/education-profiles.json'
    profiles=json.loads(profile_path.read_text()) if profile_path.exists() else []
    matching=[p for p in profiles if p.get('eventId')==event_id]
    if whole and old_category=='education' and job['category']!='education' and any(p.get('recordIds') for p in matching):raise ValueError('This school has contribution records. Review those links before moving it.')
    if whole:
        event.update(title=job['title'],description=job['caption'],date=job.get('date'))
        if job.get('date'):event['year']=int(job['date'][:4])
        elif old_date:event['year']=None
        if old_category!=job['category']:
            old_path=root/'content/categories'/(old_category+'.json');old=json.loads(old_path.read_text());old['eventIds']=[i for i in old.get('eventIds',[]) if i!=event_id]
            new_category['eventIds']=list(dict.fromkeys([*new_category.get('eventIds',[]),event_id]))
            old_path.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n');new_category_path.write_text(json.dumps(new_category,ensure_ascii=False,indent=2)+'\n');event['category']=job['category']
            for m in owned:
                for key in ('src','thumb','poster'):
                    value=m.get(key,'')
                    if not value or value.startswith('https://'):continue
                    source=(root/value).resolve()
                    if not source.is_relative_to((root/'assets').resolve()) or not source.is_file():raise ValueError('An original website asset is unavailable.')
                    relative='assets/media/'+job['category']+'/'+event_id+'/whatsapp/'+job['id']+'/'+source.name
                    destination=root/relative;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination);m[key]=relative
                    if event.get('cover')==value:event['cover']=relative
            if event.get('cover')==old.get('cover'):event['cover']=new_category['cover']
        if old_category=='education' and job['category']!='education':profiles=[p for p in profiles if p.get('eventId')!=event_id]
        if job['category']=='education':
            if not matching:profiles.append({'id':event_id,'eventId':event_id,'title':job['title'],'recordIds':[],'amountLabel':'Shared occasion','contributionText':job['caption'][:100],'description':job['caption']})
            else:
                for p in matching:p.update(title=job['title'],description=job['caption'],contributionText=job['caption'][:100])
        if old_category=='education' or job['category']=='education':profile_path.write_text(json.dumps(profiles,ensure_ascii=False,indent=2)+'\n')
    for n,m in enumerate(owned,1):
        m['caption']=job['caption'];m['title']=job['title']+' — '+{'photo':'photograph','audio':'recording','video':'video','youtube':'YouTube recording','message':'message'}.get(m['type'],'item')+' '+str(n)
        if m['type']=='photo':m['alt']=m['title']
    event.setdefault('whatsappJobIds',[]).append(job['id']);path.write_text(json.dumps(event,ensure_ascii=False,indent=2)+'\n')
    return {'eventId':event_id,'added':0,'oldCategory':old_category}

def catalog():
    run(['git','fetch','origin','main'])
    paths=run(['git','ls-tree','-r','--name-only','origin/main','content/events']).splitlines();events=[]
    for p in paths:
        if not p.endswith('.json'):continue
        e=json.loads(run(['git','show','origin/main:'+p]))
        if e.get('published') is not False and e.get('category') in CATEGORIES and e.get('presentation')!='service-story':events.append({k:e.get(k) for k in ('id','category','title','date')})
    return events

def publish(job_path):
    job_path=Path(job_path).resolve()
    if not job_path.is_relative_to(STATE.resolve()):raise ValueError('Use the private WhatsApp job inbox.')
    job=validate_job(json.loads(job_path.read_text()));receipt=job_path.parent/'result.json'
    remote=run(['git','remote','get-url','origin']).lower().removesuffix('.git')
    if remote not in ('https://github.com/'+REPO.lower(),'git@github.com:'+REPO.lower()):raise ValueError('The configured repository changed. Review the Mac setup before publishing.')
    if receipt.exists():
        last=json.loads(receipt.read_text())
        if last.get('state')=='published':return last
    gh=shutil.which('gh') or '/opt/homebrew/bin/gh'
    STATE.mkdir(parents=True,exist_ok=True)
    with (STATE/'publish.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        prepared=job_path.parent/'prepared';cache=prepared/'prepared.json'
        fingerprint=hashlib.sha256(json.dumps(job,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        cached=json.loads(cache.read_text()) if cache.exists() else None
        if job.get('revisionOf'):
            items=[]
        elif cached and cached.get('jobHash')==fingerprint and all((prepared/name).is_file() and hashlib.sha256((prepared/name).read_bytes()).hexdigest()==digest for name,digest in cached.get('files',{}).items()):
            items=cached['items']
        else:
            items=prepare(job,prepared)
            files={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in prepared.iterdir() if p.is_file() and p!=cache}
            atomic(cache,{'jobHash':fingerprint,'items':items,'files':files})
        work=ROOT/'work/whatsapp-publisher';work.mkdir(parents=True,exist_ok=True)
        result=None
        for attempt in range(3):
            run(['git','fetch','origin','main']);checkout=work/(job['id']+'-'+str(attempt))
            if checkout.exists():raise ValueError('A previous private checkout needs review before retrying.')
            run(['git','worktree','add','--detach',checkout,'origin/main'])
            try:
                result=revise_event(job,checkout) if job.get('revisionOf') else import_prepared(job,prepared,items,checkout)
                for script in ('validate.py','check_content_routes.py','build.py'):run([sys.executable,'scripts/'+script],checkout)
                if sum(p.stat().st_size for p in (checkout/'dist').rglob('*') if p.is_file())>900*1024*1024:raise ValueError('Free website storage is nearly full. Use YouTube links for longer recordings.')
                changed=run(['git','status','--porcelain'],checkout)
                if changed:
                    paths=run(['git','ls-files','--modified','--others','--exclude-standard'],checkout).splitlines()
                    permitted=('assets/media/'+job['category']+'/'+result['eventId']+'/',)
                    fixed={'content/events/'+result['eventId']+'.json','content/categories/'+job['category']+'.json','content/collections/education-profiles.json'}
                    if result.get('oldCategory'):fixed.add('content/categories/'+result['oldCategory']+'.json')
                    if any(p not in fixed and not p.startswith(permitted) for p in paths):raise ValueError('Unexpected source changes stopped this publication.')
                    run(['git','add','--',*paths],checkout)
                    run(['git','-c','user.name=Foundation WhatsApp Publisher','-c','user.email=foundation-publisher@users.noreply.github.com','commit','-m','Publish approved WhatsApp update '+job['id']],checkout)
                    pushed=subprocess.run(['git','push','origin','HEAD:main'],cwd=checkout,capture_output=True)
                    if pushed.returncode:
                        if attempt<2:continue
                        raise ValueError('Another editor changed the website. Your update is saved; send RETRY.')
                commit=run(['git','rev-parse','HEAD'],checkout);break
            finally:
                # Only this service-created, disposable checkout is removed.
                subprocess.run(['git','worktree','remove','--force',str(checkout)],cwd=ROOT,capture_output=True)
        if result is None:raise ValueError('The update could not be prepared.')
        def matching_runs():
            runs=json.loads(run([gh,'run','list','--repo',REPO,'--workflow','pages.yml','--limit','25','--json','databaseId,displayTitle,status,conclusion,url']))
            return [r for r in runs if job['id'] in r.get('displayTitle','')]
        existing=matching_runs();skip=set()
        if not existing or (existing[0]['status']=='completed' and existing[0]['conclusion']!='success'):
            skip={r['databaseId'] for r in existing}
            run([gh,'workflow','run','pages.yml','--repo',REPO,'--ref','main','-f','update_id='+job['id']])
        deadline=time.monotonic()+1500;run_info=None
        while time.monotonic()<deadline:
            matches=[r for r in matching_runs() if r['databaseId'] not in skip]
            if matches:
                run_info=matches[0]
                if run_info['status']=='completed':break
            time.sleep(10)
        if not run_info or run_info['status']!='completed':raise ValueError('Publishing is taking longer than expected. The source is saved; send RETRY to resume.')
        if run_info['conclusion']!='success':raise ValueError('GitHub Pages did not finish. The website source is saved; send RETRY.')
        result.update(state='published',commit=commit,runUrl=run_info['url'],url=SITE+'#/event/'+result['eventId'])
        atomic(receipt,result);return result

if __name__=='__main__':
    cli=argparse.ArgumentParser();cli.add_argument('--job');cli.add_argument('--catalog',action='store_true');a=cli.parse_args()
    try:print(json.dumps(catalog() if a.catalog else publish(a.job),ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error':str(e) if isinstance(e,ValueError) else 'Publication stopped safely. Check the private setup on the Mac.'}));sys.exit(1)
