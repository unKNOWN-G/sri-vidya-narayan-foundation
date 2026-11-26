#!/usr/bin/env python3
"""Run the separate uploader's local tooling without changing the live website."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess

ROOT=Path(__file__).resolve().parents[1]
SERVICE=ROOT/'services/uploader'


def runtime():
    node=shutil.which('node')
    if not node:
        location=ROOT/'work/uploader-tools/node-location.txt'
        if location.is_file():node=str(Path(location.read_text().strip())/'node')
    if not node or not Path(node).is_file():raise SystemExit('Install an active Node.js LTS release, then rerun this command.')
    env=os.environ.copy();env['PATH']=str(Path(node).parent)+os.pathsep+env.get('PATH','');env['WRANGLER_SEND_METRICS']='false'
    return node,env


def initialize():
    private=ROOT/'private';private.mkdir(exist_ok=True)
    access=private/'uploader-preview-access.json'
    if not access.exists():
        access.write_text(json.dumps({'password':secrets.token_urlsafe(18),'internal':secrets.token_hex(32)}));access.chmod(0o600)
    values=json.loads(access.read_text());target=SERVICE/'.dev.vars'
    if not target.exists():
        target.write_text('LOCAL_DEVELOPMENT="true"\nPUBLISHER_PASSWORD_HASH="'+hashlib.sha256(values['password'].encode()).hexdigest()+'"\nINTERNAL_TOKEN="'+values['internal']+'"\n');target.chmod(0o600)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=('init','preview','test','cloudflare-login','deploy'));args=parser.parse_args()
    node,env=runtime();wrangler=SERVICE/'node_modules/wrangler/bin/wrangler.js'
    if not wrangler.is_file():raise SystemExit('First run npm ci in services/uploader/.')
    if args.command in ('init','preview'):initialize()
    if args.command=='init':
        subprocess.run([node,str(wrangler),'d1','execute','swamiji-upload-inbox','--local','--file','schema.sql'],cwd=SERVICE,env=env,check=True)
        print('Local-only configuration is ready. Access details remain in private/uploader-preview-access.json.');return
    if args.command=='preview':command=[node,str(wrangler),'dev','--local','--port','8790','--ip','127.0.0.1']
    elif args.command=='test':command=[node,'--test',*[str(p.relative_to(SERVICE)) for p in sorted((SERVICE/'tests').glob('*.test.mjs'))]]
    elif args.command=='cloudflare-login':command=[node,str(wrangler),'login','--device','--browser=false','--scopes','account:read','user:read','workers_scripts:write','workers_routes:write','d1:write']
    else:
        if '00000000-0000-0000-0000-000000000000' in (SERVICE/'wrangler.toml').read_text():raise SystemExit('Create the free D1 database and configure its actual ID before deployment. See docs/UPLOADER_SETUP.md.')
        command=[node,str(wrangler),'deploy']
    os.chdir(SERVICE);os.execvpe(command[0],command,env)


if __name__=='__main__':main()
