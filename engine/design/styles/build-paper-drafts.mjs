// Draft-only reference reconstruction. No production presets or campaigns are changed.
import fs from 'node:fs';
import path from 'node:path';
import {openBrowser} from '@remotion/renderer';
import {buildHighlight} from '../../scripts/lib/instagram-highlight.mjs';

const root = process.cwd();
if (fs.existsSync(path.join(root, 'data/styles/style-3/definition.json')) || fs.existsSync(path.join(root, 'data/styles/style-4/definition.json'))) throw Error('Styles 3/4 are now saved. Do not rerun the initial draft builder over approved records; read current Paper values for a deliberate revision.');
const base = path.join(root, 'design/styles');
const emojiMap = JSON.parse(fs.readFileSync('public/emoji/map.json'));
const make = (id, lines, y, extra = {}) => ({id, lines, x: 540, y, fontFamily: 'Roboto', fontWeight: 700, fontSize: 46, letterSpacingEm: -0.01, rowHeightEm: 50.16/46, paddingXEm: 0.28, paddingYEm: 0.23, outerRadiusEm: 0.25, innerRadiusEm: 0.25, fillToken: '--color-style-3-ink', textToken: '--color-style-3-light', ...extra});
const shared = [
  ['step-1', ['📌 We find every decision maker in', 'your market']],
  ['step-2', ['📌 We use intent signals to narrow', 'the list to companies actively', 'looking for what you sell']],
  ['step-3', ['📌 We personalize every outreach', 'email using AI']],
  ['step-4', ['📌 We respond to the leads and', 'book the calls']],
];
const drafts = [
  {id:'style-3', name:'Style 3 — Coral highlights', pageId:'p-4-0', master:'CJ-0', reference:'IMG_20261003_185525_359.webp', overlay:0, blocks:[
    make('hook', ["I'm looking for 5-10 B2B companies", 'that want to send 50,000+ cold emails', 'a month to their target market.'], 276, {fontSize:52, rowHeightEm:57.6/52, paddingXEm:0.36, paddingYEm:0.22, fillToken:'--color-style-3-coral'}),
    make('intro', ["Here's how it works:"], 529, {rowHeightEm:52.8/46, paddingXEm:0.28, paddingYEm:0.2}),
    ...shared.map(([id,lines],i)=>make(id,lines,[629,780,981,1132][i])),
    make('proof',['You only have to take the calls','and close the deals.'],1337,{fontSize:49,rowHeightEm:52.8/49,paddingYEm:0.23,fillToken:'--color-style-3-pale',textToken:'--color-style-3-coral'}),
    make('cta',['If you want more info, click the','button below 👇'],1495,{fontSize:49,rowHeightEm:52.8/49,paddingYEm:0.23,fillToken:'--color-style-3-pale',textToken:'--color-style-3-coral'}),
  ]},
  {id:'style-4',name:'Style 4 — Serif hook',pageId:'p-5-0',master:'CK-0',reference:'Screenshot_20261003-192122_Gallery.jpg',referenceCrop:{top:210,height:1920,width:1080},overlay:0.25,blocks:[
    make('hook',["I'm looking for 5-10 B2B",'companies that want to send','50,000+ cold emails'],276,{fontFamily:'Times New Roman',fontWeight:400,fontSize:76,letterSpacingEm:0,rowHeightEm:84/76,fillToken:null,textToken:'--color-style-4-white'}),
    ...shared.map(([id,lines],i)=>make(id,lines,[634,800,1024,1188][i],{fontSize:48,rowHeightEm:1.15,fillToken:null,textToken:'--color-style-4-white',letterSpacingEm:0})),
    make('cta',['click the button below 👇'],1406,{fontSize:48,rowHeightEm:1.15,paddingXEm:0.3,paddingYEm:0.25,outerRadiusEm:0.2,fillToken:'--color-style-4-white',textToken:'--color-style-4-ink',letterSpacingEm:0}),
  ]},
];
const esc = s => s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const parts = line => {
  const out=[];
  for(const {segment} of new Intl.Segmenter('en',{granularity:'grapheme'}).segment(line)) {
    if(emojiMap[segment]) out.push({emoji:segment,path:path.join(root,'public',emojiMap[segment])});
    else if(out.length&&!out.at(-1).emoji) out.at(-1).text+=segment;
    else out.push({text:segment});
  }
  return out;
};
const browser = await openBrowser('chrome');
try {
  const page = await browser.newPage({context:null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
  const font = fs.readFileSync('public/fonts/Roboto-Bold.ttf').toString('base64');
  const widths = await page.evaluate(async (drafts,font,emojiKeys)=>{
    const face=new FontFace('Roboto',`url(data:font/ttf;base64,${font})`,{weight:'700'});
    await face.load();document.fonts.add(face);await document.fonts.ready;
    return drafts.map(d=>d.blocks.map(b=>b.lines.map(line=>{
      const row=document.createElement('div');
      Object.assign(row.style,{display:'flex',width:'max-content',whiteSpace:'pre',fontFamily:b.fontFamily,fontWeight:String(b.fontWeight),fontSize:b.fontSize+'px',letterSpacing:b.letterSpacingEm+'em'});
      const p=[]; for(const {segment} of new Intl.Segmenter('en',{granularity:'grapheme'}).segment(line)) {
        if(emojiKeys.includes(segment))p.push({emoji:segment});
        else if(p.length&&!p.at(-1).emoji)p.at(-1).text+=segment;else p.push({text:segment});
      }
      for(const x of p){const n=document.createElement(x.emoji?'div':'span');if(x.emoji){n.style.width=b.fontSize+'px';n.style.height=b.fontSize+'px';n.style.flexShrink='0';}else n.textContent=x.text;row.append(n);}
      document.body.append(row);const w=row.getBoundingClientRect().width;row.remove();return w;
    })));
  },drafts,font,Object.keys(emojiMap));
  for(let di=0;di<drafts.length;di++){
    const d=drafts[di];
    for(let bi=0;bi<d.blocks.length;bi++){
      const b=d.blocks[bi];b.measuredWidths=widths[di][bi];b.rowHeight=b.fontSize*b.rowHeightEm;
      b.geometry=b.fillToken?buildHighlight({textWidths:b.measuredWidths,paddingX:b.fontSize*b.paddingXEm,paddingY:b.fontSize*b.paddingYEm,rowHeight:b.rowHeight,outerRadius:b.fontSize*b.outerRadiusEm,innerRadius:b.fontSize*b.innerRadiusEm,mergeThreshold:b.fontSize*0.1}):null;
      b.width=b.geometry?.width??Math.max(...b.measuredWidths);b.height=b.geometry?.height??b.rowHeight*b.lines.length;
      const rows=b.lines.map((line,i)=>`<div layer-name="${b.id} — Row ${i+1}" style="position:absolute;left:${(b.width-b.measuredWidths[i])/2}px;top:${(b.geometry?b.fontSize*b.paddingYEm:0)+i*b.rowHeight}px;display:flex;align-items:center;width:max-content;height:${b.rowHeight}px;font-family:${b.fontFamily};font-size:${b.fontSize}px;font-weight:${b.fontWeight};letter-spacing:${b.letterSpacingEm}em;line-height:${b.rowHeight}px;color:var(${b.textToken})">${parts(line).map(x=>x.emoji?`<img layer-name="${b.id} — ${x.emoji}" src="paper-asset://${x.path}" style="width:${b.fontSize}px;height:${b.fontSize}px;flex-shrink:0" />`:`<span layer-name="${b.id} — Text ${i+1}" style="white-space:pre">${esc(x.text)}</span>`).join('')}</div>`).join('');
      const bg=b.geometry?`<svg layer-name="${b.id} — Editable joined highlight" width="${b.width}" height="${b.height}" viewBox="0 0 ${b.width} ${b.height}" style="position:absolute;left:0px;top:0px"><path d="${b.geometry.d}" fill="var(${b.fillToken})" /></svg>`:'';
      b.html=`<div layer-name="${b.id} — Move complete block" style="position:absolute;left:${b.x-b.width/2}px;top:${b.y}px;width:${b.width}px;height:${b.height}px;display:flex">${bg}${rows}</div>`;
      if(b.x-b.width/2<70||b.x+b.width/2>1010||b.y<150||b.y+b.height>1640)throw Error(`${d.id}/${b.id} outside safe area`);
      if(bi>0){const prev=d.blocks[bi-1];b.gapBefore=b.y-prev.y-prev.height;if(b.gapBefore<28)throw Error(`${d.id}/${b.id} gap ${b.gapBefore}`);}
    }
    fs.writeFileSync(path.join(base,d.id,'draft-layout.json'),JSON.stringify({...d,status:'draft-awaiting-user-tuning',canvas:{width:1080,height:1920,safeMargins:{top:150,side:70,bottom:280}},measurement:'Bundled local Roboto Bold and platform Times New Roman; Paper measurements to be read after user tuning'},null,2)+'\n');
    fs.writeFileSync(path.join(base,d.id,'reference-copy.json'),JSON.stringify({version:1,style:d.id,source:d.reference,blocks:d.blocks.map(b=>({id:b.id,text:b.lines.join(' '),lines:b.lines}))},null,2)+'\n');
    console.log(JSON.stringify({style:d.id,blocks:d.blocks.map(b=>({id:b.id,width:b.width,height:b.height,y:b.y,gap:b.gapBefore}))}));
  }
} finally {await browser.close({silent:true});}
