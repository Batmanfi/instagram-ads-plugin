"""Extract only a trusted release's declared regular files into a fresh directory."""
import sys,json,zipfile,stat,hashlib
from pathlib import Path,PurePosixPath
archive,destination,top,index=sys.argv[1:]
entries=json.loads(Path(index).read_text()); expected={e['path']:e for e in entries}
assert len(expected)==len(entries) and entries, 'Duplicate/empty archive index'
assert len(entries)<=20000 and sum(e['size'] for e in entries)<=2*1024**3, 'Archive exceeds release limits'
root=Path(destination); assert not root.exists(), 'Extraction requires a fresh directory'
with zipfile.ZipFile(archive) as z:
    assert len(z.infolist())==len(entries), 'Unexpected archive entry count'
    seen=set()
    for item in z.infolist():
        name=item.filename; parts=PurePosixPath(name).parts
        assert '\\' not in name and not name.startswith('/') and all(p not in ('..','.') for p in name.split('/')), 'Unsafe archive path'
        assert len(parts)>1 and parts[0]==top and not item.is_dir(), 'Unexpected archive root/directory'
        rel='/'.join(parts[1:]); assert rel in expected and rel not in seen, 'Unexpected/duplicate archive path'; seen.add(rel)
        mode=item.external_attr>>16
        assert not stat.S_ISLNK(mode) and (stat.S_IFMT(mode) in (0,stat.S_IFREG)), 'Archive contains a nonregular file'
        assert not item.flag_bits&1 and item.file_size==expected[rel]['size'], 'Encrypted/incorrect-size archive entry'
    assert z.testzip() is None, 'Archive CRC failure'
    root.mkdir(parents=True)
    for item in z.infolist():
        rel='/'.join(PurePosixPath(item.filename).parts[1:]); entry=expected[rel]; content=z.read(item)
        assert hashlib.sha256(content).hexdigest()==entry['sha256'], 'Archive file checksum failure'
        target=root/rel;target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('xb') as output:output.write(content)
