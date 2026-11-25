"""Exercise the publishing boundary using isolated content and real image decoding."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

SCRIPTS=Path(__file__).resolve().parents[1]/'scripts'
sys.path.insert(0,str(SCRIPTS))
from import_upload import import_batch,validate_batch
try:
    from PIL import Image
except ImportError:
    Image=None


@unittest.skipIf(Image is None,'Photo import checks require requirements-authoring.txt')
class UploadImportTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        self.photos=self.root/'incoming';self.photos.mkdir()
        (self.root/'content/events').mkdir(parents=True)
        self.write('content/categories/education.json',{'id':'education','published':True,'eventIds':[]})
        self.write('content/collections/education-profiles.json',[])
        self.photo=self.make_photo('red')
        self.batch={'id':'11111111-1111-4111-8111-111111111111','category':'education','title':'Air Force School, Yelahanka','caption':'Swamiji blessed and encouraged the students.','location':'Bengaluru','date':None,'target':None,'confirmed':True,'cover':self.photo['id'],'photos':[self.photo]}

    def write(self,name,data):
        p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data))

    def make_photo(self,colour):
        p=self.photos/'temporary.webp';Image.new('RGB',(160,90),colour).save(p,'WEBP');raw=p.read_bytes();digest=hashlib.sha256(raw).hexdigest();p.rename(self.photos/(digest+'.webp'));return {'id':digest,'bytes':len(raw),'position':0}

    def test_school_import_is_reachable_without_inventing_a_donation(self):
        result=import_batch(self.batch,self.photos,self.root)
        p=self.root/'content/events'/(result['id']+'.json');event=json.loads(p.read_text())
        self.assertIsNone(event['date']);self.assertEqual(event['title'],self.batch['title'])
        self.assertEqual(event['description'],self.batch['caption']);self.assertEqual(event['counts'],{'photos':1})
        profile=json.loads((self.root/'content/collections/education-profiles.json').read_text())[0]
        self.assertEqual(profile['eventId'],result['id']);self.assertEqual(profile['recordIds'],[]);self.assertNotIn('amount',profile)
        self.assertNotIn('/Users/',p.read_text());self.assertNotIn('source_path',p.read_text())

    def test_workflow_retry_does_not_duplicate_an_event(self):
        first=import_batch(self.batch,self.photos,self.root);second=import_batch(self.batch,self.photos,self.root)
        self.assertEqual(first['id'],second['id']);self.assertTrue(second['alreadyImported'])
        self.assertEqual(len(list((self.root/'content/events').glob('*.json'))),1)

    def test_existing_occasion_keeps_its_identity_and_deduplicates_photos(self):
        first=import_batch(self.batch,self.photos,self.root);path=self.root/'content/events'/(first['id']+'.json');old=json.loads(path.read_text())
        batch=copy.deepcopy(self.batch);batch.update(id='22222222-2222-4222-8222-222222222222',target=first['id'],title='An extra collection',caption='More photographs of this occasion.')
        result=import_batch(batch,self.photos,self.root);new=json.loads(path.read_text())
        self.assertEqual(result['added'],0);self.assertEqual(new['cover'],old['cover']);self.assertEqual(new['title'],old['title']);self.assertEqual(len(new['media']),1)
        another=self.make_photo('blue');batch.update(id='33333333-3333-4333-8333-333333333333',photos=[another],cover=another['id'])
        self.assertEqual(import_batch(batch,self.photos,self.root)['added'],1)
        self.assertEqual(json.loads(path.read_text())['counts'],{'photos':2})

    def test_corrupt_or_changed_photo_is_rejected_before_any_content_write(self):
        (self.photos/(self.photo['id']+'.webp')).write_bytes(b'not an image')
        with self.assertRaisesRegex(ValueError,'verification'):import_batch(self.batch,self.photos,self.root)
        self.assertEqual(list((self.root/'content/events').iterdir()),[])

    def test_unconfirmed_or_misclassified_updates_are_rejected(self):
        for changed in ({'confirmed':False},{'category':'teachings'},{'target':'../outside'},{'cover':'unlisted'}):
            with self.assertRaises(ValueError):validate_batch({**self.batch,**changed})

    def test_date_is_never_taken_from_an_upload_id(self):
        batch=copy.deepcopy(self.batch);batch['date']='2026-02-30'
        with self.assertRaises(ValueError):validate_batch(batch)
