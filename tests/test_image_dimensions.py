"""New covers must keep their real shape without a responsive-image catalogue."""
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from image_dimensions import image_dimensions,cover_dimensions
try:
    from PIL import Image
except ImportError:
    Image=None

@unittest.skipIf(Image is None,'Image fixture generation needs the authoring environment.')
class CoverDimensionsTests(unittest.TestCase):
    def test_reads_real_landscape_and_portrait_files_in_supported_encodings(self):
        with tempfile.TemporaryDirectory() as tmp:
            for fmt,options,mode in [('WEBP',{},'RGB'),('WEBP',{'lossless':True},'RGB'),('WEBP',{},'RGBA'),('PNG',{},'RGB'),('JPEG',{'progressive':True},'RGB')]:
                for dimensions in [(640,291),(291,640)]:
                    with self.subTest(format=fmt,options=options,mode=mode,dimensions=dimensions):
                        p=Path(tmp)/('cover.'+fmt.lower());Image.new(mode,dimensions).save(p,fmt,**options)
                        self.assertEqual(image_dimensions(p),dimensions)

    def test_new_cover_gets_dimensions_without_variants_and_unsafe_paths_are_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'assets').mkdir();Image.new('RGB',(1280,582)).save(root/'assets/new-cover.webp','WEBP')
            manifest={'events':[{'cover':'assets/new-cover.webp'},{'cover':'../private.webp'},{'cover':'https://example.com/cover.jpg'}]}
            self.assertEqual(cover_dimensions(manifest,root),{'assets/new-cover.webp':{'width':1280,'height':582}})

    def test_missing_and_truncated_images_have_no_fake_dimensions(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'bad.webp';p.write_bytes(b'RIFF\x00\x00\x00\x00WEBPVP8X')
            self.assertIsNone(image_dimensions(p));self.assertIsNone(image_dimensions(Path(tmp)/'missing.webp'))
