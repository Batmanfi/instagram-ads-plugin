"""Generate mathematical video/audio fixtures; never read original media."""
from pathlib import Path
import json,hashlib,subprocess,shutil
root=Path(__file__).resolve().parent.parent;out=root/'.local/pilot-assets/synthetic-pilot-v1'
assert not out.exists(), 'Keep published fixture versions immutable; choose a new version instead of overwriting'
(out/'backgrounds').mkdir(parents=True);(out/'music').mkdir()
commands=[]
def ffmpeg(args):
 commands.append(['ffmpeg',*args]);subprocess.run(['ffmpeg','-hide_banner','-loglevel','error',*args],check=True)
portrait=out/'portrait-master.mp4';landscape=out/'landscape-master.mp4'
for file,size in [(portrait,'360x640'),(landscape,'640x360')]:
 ffmpeg(['-f','lavfi','-i',f'testsrc2=size={size}:rate=30:duration=12','-vf','eq=brightness=-0.35:saturation=0.25','-an','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p',str(file)])
for background in json.loads((root/'plugins/instagram-ads/resources/data/backgrounds.json').read_text()):
 if background['suitableFor10Seconds'] and background['duration']>=10:
  source=landscape if background['width']>background['height'] else portrait
  shutil.copyfile(source,out/'backgrounds'/background['filename'])
portrait.unlink();landscape.unlink()
for track,tones in zip(json.loads((root/'plugins/instagram-ads/resources/data/music.json').read_text())['tracks'],[(220,277.18,329.63),(261.63,329.63,392),(196,246.94,293.66)]):
 expression='0.20*('+ '+'.join(f'sin(2*PI*{frequency}*t)' for frequency in tones)+')/3'
 ffmpeg(['-f','lavfi','-i',f'aevalsrc={expression}:s=48000:d=12','-ac','2','-c:a','libmp3lame','-b:a','128k',str(out/'music'/track['filename'])])
(out/'RIGHTS-AND-SCOPE.md').write_text('''# Synthetic installation pilot fixture rights and scope

These files were generated from FFmpeg's mathematical test patterns and explicitly defined sine waves. No original project scenery, supplied music, source audio or system font was copied. The project supplies these generated fixtures for private team installation/QA testing.

Original inventory filenames and track IDs are compatibility keys only. These are NOT Mount Rainier/city/coast footage, 4K footage, Chill Sunday, Hush or Sunday Evening recordings. Do not use or describe them as the supplied production media. Music controls use the existing three IDs for pipeline coverage; the audible tracks are labeled synthetic test tones in this kit's documentation.

Video is deliberately reduced-resolution synthetic moving test imagery; portrait and landscape aspect/crop paths remain testable. All included clips/tracks provide a full 10-second excerpt with slack. Real scenic contrast/motion, original 4K framing and subjective playback/music quality require a separately approved production-media campaign on the second Mac. Existing production styles, fonts, spacing, source text and engine remain unchanged.

Roboto/emoji third-party notices remain in the engine. Times New Roman is not supplied and must exist on the teammate Mac. Distribution of original scenery/music remains a separate decision.
''')
provenance={'version':1,'synthetic':True,'generator':'create-pilot-assets.py','ffmpegVersion':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],'commands':[[arg.replace(str(out),'<fixture-output>') for arg in command] for command in commands],'originalMediaRead':False,'compatibilityKeysOnly':True}
(out/'generation.json').write_text(json.dumps(provenance,indent=2)+'\n')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[{'path':p.relative_to(out).as_posix(),'size':p.stat().st_size,'sha256':sha(p)} for p in sorted(out.rglob('*')) if p.is_file()]
manifest={'version':1,'id':'synthetic-pilot-v1','distributionStatus':'approved-private-distribution','rightsRecord':'RIGHTS-AND-SCOPE.md','synthetic':True,'files':files}
file=root/'asset-manifests/synthetic-pilot-v1.json';file.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'root':str(out),'manifest':str(file),'files':len(files),'bytes':sum(p['size'] for p in files),'originalMediaRead':False},indent=2))
