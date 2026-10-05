"""Archive direct approved Paper reads into separate copy, layout and presets.

This is the 2026-10-03 save operation, not a generic campaign importer.
Refresh paper-approved-snapshot.json via MCP before any deliberate resave.
"""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[2]
role_for = lambda bid: 'hook' if bid == 'hook' else 'label' if bid == 'intro' else 'proof' if bid == 'proof' else 'cta' if bid == 'cta' else 'support'
def write(p, v):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(v, indent=2, ensure_ascii=False)+'\n')

for sid in ['style-3', 'style-4']:
    folder = root/'design/styles'/sid
    draft = json.loads((folder/'draft-layout.json').read_text())
    snapshot = json.loads((folder/'paper-approved-snapshot.json').read_text())
    mapping = json.loads((folder/'paper-map.json').read_text())
    source = json.loads((folder/'reference-copy.json').read_text())
    css = snapshot['styles']; text_nodes = {n['id']:n['textContent'] for n in snapshot['textNodes']}
    roles = {}; ref_blocks = []; copy_blocks = []; input_blocks = []
    assert len(draft['blocks']) == len(mapping['blocks']) == len(source['blocks'])
    for b, m, c in zip(draft['blocks'], mapping['blocks'], source['blocks']):
        texts = [text_nodes[n] for n in m['textNodes']]
        expected = [line.replace('📌','').replace('👇','') for line in c['lines']]
        if texts != expected:
            raise ValueError(f'{sid}/{b["id"]}: Paper copy edited; read current row/emoji structure before saving')
        t = css[m['textNodes'][0]]; row = css[m['rowNodes'][0]]; group = css[m['paperNode']]
        size = float(t['fontSize'].removesuffix('px')); row_height = float(row['height'].removesuffix('px'))
        tracking = float(t.get('letterSpacing','0em').removesuffix('em'))
        family = 'Times New Roman' if 'Times' in t['fontFamily'] else 'Roboto'
        geom = {key:b[key] for key in ['paddingXEm','paddingYEm','rowHeightEm','outerRadiusEm','innerRadiusEm']}
        geom['rowHeightEm'] = row_height/size
        if b['fillToken'] is None:
            geom['paddingXEm'] = geom['paddingYEm'] = 0
        role = role_for(b['id'])
        highlight = 'plain' if b['fillToken'] is None else 'white' if b['fillToken'] in ['--color-style-3-pale','--color-style-4-white'] else 'black'
        settings = dict(fontSize=size,highlight=highlight,preset='hook' if role=='hook' else 'label' if role=='label' else 'white' if highlight=='white' else 'black',fontFamily=family,fontWeight=t['fontWeight'],letterSpacingEm=tracking,geometry=geom,textColor=snapshot['tokens'][b['textToken']],highlightColor=snapshot['tokens'].get(b['fillToken']))
        if family == 'Times New Roman':
            settings['fontSource'] = 'local("Times New Roman"), local("TimesNewRomanPSMT")'
        if role in roles and roles[role] != settings:
            raise ValueError(f'{sid}: inconsistent {role} settings; preserve per-block tuning explicitly')
        roles[role] = settings
        x = float(group['left'].removesuffix('px'))+float(group['width'].removesuffix('px'))/2
        y = float(group['top'].removesuffix('px'))
        ref_blocks.append(dict(id=b['id'],styleRole=role,fontSize=size,highlight=highlight,x=x,y=y,lines=c['lines'],maxWidth=940))
        copy_blocks.append(dict(id=b['id'],text=c['text']))
        input_blocks.append(dict(id=b['id'],preset=settings['preset'],x=x,y=y,fontSize=size,fontFamily=family,fontWeight=t['fontWeight'],letterSpacingEm=tracking,geometry=geom,fill=settings['highlightColor'],textColor=settings['textColor'],lines=c['lines'],highlight=highlight))
    if sid == 'style-4':
        roles['label'] = dict(roles['support']); roles['proof'] = dict(roles['support'])
    highlights = {p:dict(root_role['geometry']) for p,root_role in [('hook',roles['hook']),('label',roles['label']),('white',roles['cta']),('black',roles['support'])]}
    profile = dict(id=sid,name=draft['name'],version=1,savedOn='2026-10-03',status='user-approved',canvas=draft['canvas'],fps=30,durationInFrames=300,minBlockGap=28,minFontSize=44,maxWidth=940,fontFile='public/fonts/Roboto-Bold.ttf',fontFamily='Roboto',fontWeight=700,fontPreset='wide-bold',letterSpacingEm=-0.01 if sid=='style-3' else 0,defaultContrast=0.28,mergeThresholdEm=0.1,highlightPresets=highlights,roles=roles,paperUrl=f'https://app.paper.design/file/{mapping["fileId"]}/{mapping["pageId"]}',reference=f'data/styles/{sid}/reference-input.json',approvalNote=snapshot['approval'],layoutPolicy='data/layout/defaults.json')
    dest = root/'data/styles'/sid
    write(dest/'definition.json',profile)
    ad = dict(id=f'{sid}-reference',outputName=f'{sid}-reference',style=sid,fontPreset='wide-bold',layoutMode='compact',contrast=0.28,background=dict(filename='01-Mount-Rainier-Road-1080x1920.mp4',startTime=0,cropPosition=[50,50]),blocks=ref_blocks)
    write(dest/'reference-copy.json',dict(version=1,source='Approved reference example only; not copy authority for future ads.',ads=[dict(id=ad['id'],blocks=copy_blocks)]))
    write(dest/'reference-manifest.json',dict(version=1,style=sid,safeMargins=profile['canvas']['safeMargins'],defaultContrast=0.28,ads=[ad]))
    write(dest/'reference-input.json',dict(version=1,style=sid,canvas=profile['canvas'],fontFile=profile['fontFile'],fontFamily=profile['fontFamily'],fontWeight=profile['fontWeight'],letterSpacingEm=profile['letterSpacingEm'],blocks=input_blocks,note='Read current Paper widths or measure after font loading. Do not reuse these widths for new copy.'))
    print(sid, 'saved', len(copy_blocks), 'blocks', 'contrast', profile['defaultContrast'])
