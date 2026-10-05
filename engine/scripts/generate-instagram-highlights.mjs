import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openBrowser} from '@remotion/renderer';
import {buildHighlight, optionsForBlock, calibratedPresets} from './lib/instagram-highlight.mjs';
import {buildLiveEditor} from './lib/highlight-editor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (key, fallback) => {
  const i = args.indexOf(key);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Missing value for ${key}`);
  return args[i + 1];
};
const inputPath = path.resolve(root, arg('--input', 'design/instagram-highlight/paper-input.json'));
const output = path.resolve(root, arg('--output', 'work/instagram-highlights'));
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (input.version !== 1 || !input.blocks?.length) throw Error('Expected version 1 and nonempty blocks');
const font = fs.readFileSync(path.resolve(root, input.fontFile)).toString('base64');
const emojiMap = JSON.parse(fs.readFileSync(path.join(root, 'public/emoji/map.json')));
const emojiData = Object.fromEntries(Object.entries(emojiMap).map(([emoji, filename]) => [emoji, 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'public', filename)).toString('base64')]));
let localWidths;
const mustMeasure = args.includes('--measure-local') || input.blocks.some(b => !b.measuredWidths);
if (mustMeasure) {
  const browser = await openBrowser('chrome');
  try {
    const page = await browser.newPage({context: null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {}});
    localWidths = await page.evaluate(async (input, font, emojiData) => {
      const face = new FontFace(input.fontFamily, `url(data:font/ttf;base64,${font})`, {weight: String(input.fontWeight)});
      await face.load(); document.fonts.add(face); await document.fonts.ready;
      return input.blocks.map(b => b.lines.map(line => {
        const row = document.createElement('div');
        Object.assign(row.style, {display: 'flex', width: 'max-content', whiteSpace: 'pre', fontFamily: input.fontFamily, fontWeight: String(input.fontWeight), fontSize: b.fontSize + 'px', letterSpacing: input.letterSpacingEm + 'em'});
        const parts = []; for (const {segment} of new Intl.Segmenter('en', {granularity: 'grapheme'}).segment(line)) {
          if (emojiData[segment]) parts.push({emoji: segment});
          else if (parts.length && !parts.at(-1).emoji) parts.at(-1).text += segment;
          else parts.push({text: segment});
        }
        for (const part of parts) {
          const node = document.createElement(part.emoji ? 'img' : 'span');
          if (part.emoji) {node.src = emojiData[part.emoji]; node.style.width = b.fontSize + 'px'; node.style.height = b.fontSize + 'px'; node.style.flexShrink = '0';}
          else node.textContent = part.text;
          row.append(node);
        }
        document.body.append(row); const width = row.getBoundingClientRect().width; row.remove(); return width;
      }));
    }, input, font, emojiData);
  } finally {await browser.close({silent: true});}
}
const esc = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const records = input.blocks.map((b, i) => {
  if (!/^[a-z0-9-]+$/i.test(b.id) || b.fontSize < 44 || b.lines.some(l => !l.trim())) throw Error(`Invalid block ${b.id}`);
  const measured = localWidths?.[i] ?? b.measuredWidths;
  if (measured.length !== b.lines.length) throw Error(`Width count differs for ${b.id}`);
  const geometry = buildHighlight(optionsForBlock(b, measured));
  const tokenName = `${input.tokenPrefix ?? '--color-highlight-'}${b.id}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${geometry.width}" height="${geometry.height}" viewBox="0 0 ${geometry.width} ${geometry.height}"><path d="${geometry.d}" fill="${esc(b.fill)}"/></svg>`;
  const paperHtml = `<svg layer-name="${b.id} — Generated joined highlight — color token" width="${geometry.width}" height="${geometry.height}" viewBox="0 0 ${geometry.width} ${geometry.height}" style="position:absolute;left:0px;top:0px"><path d="${geometry.d}" fill="var(${tokenName})" /></svg>`;
  return {...b, tokenName, measurementMode: localWidths ? 'DOM with bundled local font and tracking' : 'supplied exact Paper widths', geometry, svg, paperHtml};
});
const safe = input.canvas.safeMargins;
for (const b of records) {
  const g = b.geometry;
  if (b.x - g.width / 2 < safe.side || b.x + g.width / 2 > input.canvas.width - safe.side || b.y < safe.top || b.y + g.height > input.canvas.height - safe.bottom) throw Error(`${b.id} exceeds safe margins; adjust layout, not copy`);
}
const ordered = [...records].sort((a, b) => a.y - b.y);
for (let i = 1; i < ordered.length; i++) if (ordered[i].y - ordered[i - 1].y - ordered[i - 1].geometry.height < 28) throw Error(`${ordered[i].id}: block gap below 28 px`);
fs.mkdirSync(output, {recursive: true});
for (const b of records) fs.writeFileSync(path.join(output, `${b.id}-highlight.svg`), b.svg);
fs.writeFileSync(path.join(output, 'paper-layout.json'), JSON.stringify({...input, generatedAt: new Date().toISOString(), blocks: records}, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'highlight-editor.html'), buildLiveEditor(input, font, emojiData, buildHighlight, calibratedPresets));
console.log(JSON.stringify({output, blocks: records.map(b => ({id: b.id, width: b.geometry.width, height: b.geometry.height, measurement: b.measurementMode})), safeMargins: 'passed', gaps: 'passed'}, null, 2));
