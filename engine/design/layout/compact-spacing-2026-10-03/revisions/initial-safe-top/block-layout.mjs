import policy from '../../data/layout/defaults.json' with {type: 'json'};

// Font-loaded measurements include the complete contour, not just text rows.
// Keep the hook anchored and let the CTA follow the content naturally.
export function stackBlocks(heights, safeMargins, mode = policy.defaultMode, canvasHeight = 1920) {
  if (!['compact', 'distributed'].includes(mode)) throw Error(`Unknown layout mode: ${mode}`);
  if (!Array.isArray(heights) || !heights.length || heights.some(h => !Number.isFinite(h) || h <= 0)) throw Error('Expected positive measured block heights');
  const {top, bottom} = safeMargins;
  if (![top, bottom, canvasHeight].every(Number.isFinite) || top < 0 || bottom < 0 || canvasHeight <= top + bottom) throw Error('Invalid vertical safe area');
  const available = canvasHeight - top - bottom;
  const totalHeight = heights.reduce((sum, height) => sum + height, 0);
  const intervals = heights.length - 1;
  if (totalHeight + policy.minGap * intervals > available + 0.000001) throw Error(`Copy cannot fit legibly with ${policy.minGap}px block gaps. Request shorter copy.`);
  const availableGap = intervals ? (available - totalHeight) / intervals : 0;
  const gap = intervals ? Math.max(policy.minGap, mode === 'compact' ? Math.min(policy.preferredGap, availableGap) : availableGap) : 0;
  let y = top;
  const tops = heights.map(height => {
    const current = y;
    y += height + gap;
    return current;
  });
  const groupBottom = y - gap;
  return {mode, tops, gap, totalHeight, groupBottom, spareBelow: canvasHeight - bottom - groupBottom};
}
