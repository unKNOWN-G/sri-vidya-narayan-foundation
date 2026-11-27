#!/usr/bin/env python3
"""Local WhatsApp companion setup; connecting is a separate, approved step."""
import argparse
import os
from pathlib import Path
import plistlib
import subprocess
import sys
from uploader_tool import ROOT,runtime

SERVICE=ROOT/'services/whatsapp'
LABEL='org.srividyanarayan.whatsapp-publisher'

def main():
    cli=argparse.ArgumentParser();cli.add_argument('command',choices=('init','test','setup','connect','install','stop','status'));a=cli.parse_args()
    node,env=runtime();private=ROOT/'private/whatsapp';private.mkdir(parents=True,exist_ok=True);private.chmod(0o700)
    if a.command=='init':
        subprocess.run([str(Path(node).parent/'npm'),'ci','--no-audit','--no-fund'],cwd=SERVICE,env=env,check=True)
        python=SERVICE/'.venv/bin/python'
        if not python.exists():subprocess.run([sys.executable,'-m','venv',str(SERVICE/'.venv')],check=True)
        subprocess.run([str(python),'-m','pip','install','-r',str(SERVICE/'requirements.txt')],check=True);return
    if a.command=='test':
        subprocess.run([node,'--test',*[str(p) for p in (SERVICE/'tests').glob('*.test.mjs')]],env=env,check=True)
        subprocess.run([str(SERVICE/'.venv/bin/python'),'-m','unittest','discover','-s','tests','-p','test_whatsapp_publish.py'],cwd=ROOT,check=True);return
    if a.command in ('setup','connect'):
        args=[node,str(SERVICE/'bridge.mjs')]+(['--connect'] if a.command=='connect' else [])
        os.execvpe(args[0],args,env)
    domain='gui/'+str(os.getuid());plist=Path.home()/'Library/LaunchAgents'/(LABEL+'.plist')
    if a.command=='install':
        plist.parent.mkdir(parents=True,exist_ok=True)
        values={'Label':LABEL,'ProgramArguments':[node,str(SERVICE/'bridge.mjs'),'--connect'],'WorkingDirectory':str(ROOT),'RunAtLoad':True,'KeepAlive':{'SuccessfulExit':False},'ThrottleInterval':60,'EnvironmentVariables':{'PATH':env['PATH']},'StandardOutPath':str(private/'service.log'),'StandardErrorPath':str(private/'service-error.log')}
        with plist.open('wb') as f:plistlib.dump(values,f)
        plist.chmod(0o600)
        subprocess.run(['launchctl','bootstrap',domain,str(plist)],check=True)
        print('Companion installed for this Mac login. Private setup: http://127.0.0.1:8998/');return
    if a.command=='stop':subprocess.run(['launchctl','bootout',domain+'/'+LABEL],check=True);return
    subprocess.run(['launchctl','print',domain+'/'+LABEL],check=True)

if __name__=='__main__':main()
