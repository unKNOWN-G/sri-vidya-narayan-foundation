"""Read intrinsic raster dimensions without adding an imaging build dependency."""
from pathlib import Path


def image_dimensions(path):
    try:
        with Path(path).open('rb') as file:
            header=file.read(32)
            if header.startswith(b'\x89PNG\r\n\x1a\n') and len(header)>=24:
                size=(int.from_bytes(header[16:20],'big'),int.from_bytes(header[20:24],'big'))
                return size if all(0<n<=100000 for n in size) else None
            if header[:4]==b'RIFF' and header[8:12]==b'WEBP':
                file.seek(12)
                for _ in range(64):
                    chunk=file.read(8)
                    if len(chunk)!=8:return None
                    length=int.from_bytes(chunk[4:8],'little');data=file.read(min(length,10))
                    if chunk[:4]==b'VP8X' and len(data)>=10:return (int.from_bytes(data[4:7],'little')+1,int.from_bytes(data[7:10],'little')+1)
                    if chunk[:4]==b'VP8L' and len(data)>=5 and data[0]==0x2f:
                        bits=int.from_bytes(data[1:5],'little');return ((bits&0x3fff)+1,((bits>>14)&0x3fff)+1)
                    if chunk[:4]==b'VP8 ' and len(data)>=10 and data[3:6]==b'\x9d\x01\x2a':return (int.from_bytes(data[6:8],'little')&0x3fff,int.from_bytes(data[8:10],'little')&0x3fff)
                    file.seek(length-len(data)+(length&1),1)
            if header[:2]==b'\xff\xd8':
                file.seek(2)
                for _ in range(256):
                    if file.read(1)!=b'\xff':return None
                    marker=file.read(1)
                    while marker==b'\xff':marker=file.read(1)
                    if not marker or marker in (b'\xda',b'\xd9'):return None
                    if marker[0] in range(0xd0,0xd9) or marker==b'\x01':continue
                    length=int.from_bytes(file.read(2),'big')
                    if length<2:return None
                    if marker[0] in (0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf):
                        data=file.read(5)
                        if len(data)==5:return (int.from_bytes(data[3:5],'big'),int.from_bytes(data[1:3],'big'))
                        return None
                    file.seek(length-2,1)
    except (OSError,ValueError):pass
    return None


def cover_dimensions(manifest,root):
    root=Path(root).resolve();sizes={}
    covers={r.get('cover') for kind in ('categories','events') for r in manifest.get(kind,[]) if r.get('cover')}
    for source in covers:
        if not source.startswith('assets/'):continue
        path=(root/source).resolve()
        if not path.is_relative_to(root/'assets'):continue
        size=image_dimensions(path)
        if size and min(size)>0:sizes[source]={'width':size[0],'height':size[1]}
    return sizes
