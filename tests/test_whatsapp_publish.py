"""Check private mixed-media intake without an account or any publication."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPTS=Path(__file__).resolve().parents[1]/'scripts'
sys.path.insert(0,str(SCRIPTS))
from whatsapp_publish import validate_job,prepare,import_prepared,transcode

class MixedMediaTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.originals=self.root/'originals';self.originals.mkdir();self.prepared=self.root/'prepared'
        (self.root/'content/categories').mkdir(parents=True);(self.root/'content/events').mkdir();(self.root/'content/collections').mkdir()
        self.write('content/categories/education.json',{'id':'education','cover':'assets/school.webp','eventIds':[]})
        self.write('content/collections/education-profiles.json',[])
        self.job={'id':'11111111-1111-4111-8111-111111111111','confirmed':True,'category':'education','title':'Gollapalli High School','caption':'Swamiji blessed and encouraged the students.','target':None,'date':None,'items':[]}

    def write(self,p,d):
        path=self.root/p;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(d))

    def test_mixed_event_is_reachable_idempotent_and_never_invents_a_donation(self):
        try:from PIL import Image
        except ImportError:self.skipTest('Use the WhatsApp service virtual environment.')
        p=self.originals/('a'*64+'.bin');Image.new('RGB',(120,80),'orange').save(p,'JPEG')
        self.job['items']=[{'kind':'photo','file':p.name},{'kind':'youtube','youtubeId':'AbCdEfG1234'},{'kind':'message','text':'Gratitude <script>alert(1)</script> & service.'}]
        items=prepare(self.job,self.prepared,self.originals);result=import_prepared(self.job,self.prepared,items,self.root)
        event=json.loads((self.root/'content/events'/(result['eventId']+'.json')).read_text())
        self.assertEqual(event['counts'],{'photos':1,'youtube':1,'messages':1});self.assertIsNone(event['date'])
        self.assertEqual(import_prepared(self.job,self.prepared,items,self.root)['added'],0)
        profile=json.loads((self.root/'content/collections/education-profiles.json').read_text())[0]
        self.assertEqual(profile['recordIds'],[]);self.assertNotIn('amount',profile)
        message=next(m for m in event['media'] if m['type']=='message');page=(self.root/message['src']).read_text()
        self.assertIn('&lt;script&gt;',page);self.assertNotIn('<script>',page)
        retry=copy.deepcopy(self.job);retry['id']='22222222-2222-4222-8222-222222222222';retry['target']=result['eventId']
        self.assertEqual(import_prepared(retry,self.prepared,items,self.root)['added'],0)

    def test_misclassified_unconfirmed_and_path_traversal_inputs_are_refused(self):
        self.job['items']=[{'kind':'message','text':'A supplied message.'}]
        for change in ({'confirmed':False},{'category':'unknown'},{'items':[{'kind':'photo','file':'../../secret'}]},{'items':[{'kind':'youtube','youtubeId':'../../secret'}]}):
            with self.assertRaises(ValueError):validate_job({**self.job,**change})

    def test_audio_and_video_are_converted_to_browser_formats(self):
        try:import imageio_ffmpeg
        except ImportError:self.skipTest('Use the WhatsApp service virtual environment.')
        ff=imageio_ffmpeg.get_ffmpeg_exe();audio=self.root/'voice.ogg';video=self.root/'clip.mov'
        subprocess.run([ff,'-v','error','-y','-f','lavfi','-i','sine=frequency=500:duration=0.2','-c:a','libopus',str(audio)],check=True)
        subprocess.run([ff,'-v','error','-y','-f','lavfi','-i','color=c=orange:s=160x120:d=0.2','-c:v','libx264',str(video)],check=True)
        transcode(audio,self.root/'voice.m4a','audio');transcode(video,self.root/'clip.mp4','video',self.root/'poster.webp')
        for name in ('voice.m4a','clip.mp4','poster.webp'):self.assertGreater((self.root/name).stat().st_size,20)

if __name__=='__main__':unittest.main()
