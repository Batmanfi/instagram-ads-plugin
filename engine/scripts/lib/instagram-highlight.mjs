// Pure geometry shared by the CLI and the standalone live editor.
// One outline with true circular convex/concave corners; no stacked pills.
import style1 from '../../data/styles/style-1/definition.json' with {type: 'json'};
export function buildHighlight(options) {
  const {textWidths, rowHeight, paddingX, paddingY, outerRadius, innerRadius = outerRadius, mergeThreshold = 0} = options;
  if (!Array.isArray(textWidths) || !textWidths.length || textWidths.some(w => !Number.isFinite(w) || w <= 0)) throw Error('Expected nonempty positive text widths');
  for (const [key, v] of Object.entries({rowHeight, paddingX, paddingY, outerRadius, innerRadius, mergeThreshold})) {
    if (!Number.isFinite(v) || v < 0 || (key === 'rowHeight' && v === 0)) throw Error(`Invalid ${key}`);
  }
  if (2 * paddingY >= rowHeight) throw Error('Vertical padding must be less than half the row height');
  const widths = textWidths.map(w => w + paddingX * 2);
  // Tiny differences produce almost invisible scallops. Join only contiguous
  // widths whose entire range is within the threshold; never shrink a line.
  for (let start = 0; start < widths.length;) {
    let end = start + 1, min = widths[start], max = min;
    while (end < widths.length && Math.max(max, widths[end]) - Math.min(min, widths[end]) <= mergeThreshold) {
      min = Math.min(min, widths[end]); max = Math.max(max, widths[end]); end++;
    }
    for (let i = start; i < end; i++) widths[i] = max;
    start = end;
  }
  const width = Math.max(...widths), height = rowHeight * widths.length + 2 * paddingY;
  const left = i => (width - widths[i]) / 2, right = i => (width + widths[i]) / 2;
  // Union of overlapping padded line boxes. When the next line is wider,
  // its top starts the step. When it is narrower, the wider box continues
  // to its bottom. A fixed halfway boundary misses Instagram's silhouette.
  const boundary = i => (i + 1) * rowHeight + (widths[i + 1] < widths[i] ? 2 * paddingY : 0);
  const points = [[left(0), 0], [right(0), 0]];
  for (let i = 0; i < widths.length - 1; i++) points.push([right(i), boundary(i)], [right(i + 1), boundary(i)]);
  points.push([right(widths.length - 1), height], [left(widths.length - 1), height]);
  for (let i = widths.length - 1; i > 0; i--) points.push([left(i), boundary(i - 1)], [left(i - 1), boundary(i - 1)]);
  const unique = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  // Remove straight-through vertices, including equal-width adjacent lines.
  let changed = true;
  while (changed && unique.length > 4) {
    changed = false;
    for (let i = 0; i < unique.length; i++) {
      const a = unique[(i + unique.length - 1) % unique.length], b = unique[i], c = unique[(i + 1) % unique.length];
      if ((b[0] - a[0]) * (c[1] - b[1]) === (b[1] - a[1]) * (c[0] - b[0])) {unique.splice(i, 1); changed = true; break;}
    }
  }
  const corners = unique.map((p, i) => {
    const a = unique[(i + unique.length - 1) % unique.length], b = unique[(i + 1) % unique.length];
    const cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const radius = Math.min(cross > 0 ? outerRadius : innerRadius, da / 2, db / 2);
    return {radius, sweep: cross > 0 ? 1 : 0, before: [p[0] + (a[0] - p[0]) * radius / da, p[1] + (a[1] - p[1]) * radius / da], after: [p[0] + (b[0] - p[0]) * radius / db, p[1] + (b[1] - p[1]) * radius / db]};
  });
  const n = v => Number(v.toFixed(4)), xy = p => p.map(n).join(' ');
  const d = `M ${xy(corners[0].before)} ` + corners.map(c => `L ${xy(c.before)} ${c.radius ? `A ${n(c.radius)} ${n(c.radius)} 0 0 ${c.sweep} ${xy(c.after)}` : `L ${xy(c.after)}`}`).join(' ') + ' Z';
  return {width, height, widths, textWidths: [...textWidths], rowHeight, paddingX, paddingY, outerRadius, innerRadius, d};
}

export const calibratedPresets = style1.highlightPresets;

export function optionsForBlock(block, textWidths) {
  const preset = {...calibratedPresets[block.preset ?? (block.fill === '#FFFFFF' ? 'white' : 'black')], ...block.geometry};
  const s = block.fontSize;
  return {textWidths, rowHeight: s * preset.rowHeightEm, paddingX: s * preset.paddingXEm, paddingY: s * preset.paddingYEm, outerRadius: s * preset.outerRadiusEm, innerRadius: s * preset.innerRadiusEm, mergeThreshold: s * style1.mergeThresholdEm};
}
