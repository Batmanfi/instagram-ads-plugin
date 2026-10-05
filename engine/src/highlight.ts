// Outline of the union of adjoining centered line rectangles. Round both convex
// outer corners and concave step transitions, without gaps or per-line pills.
export const highlightPath = (
  widths: number[],
  rowHeight: number,
  padY: number,
  radius: number,
) => {
  const points: [number, number][] = [];
  const edge = (i: number, side: number) => (side * widths[i]) / 2;
  const top = (i: number) => (i === 0 ? 0 : padY + i * rowHeight);
  const bottom = (i: number) =>
    i === widths.length - 1
      ? 2 * padY + widths.length * rowHeight
      : padY + (i + 1) * rowHeight;
  points.push([edge(0, -1), 0], [edge(0, 1), 0]);
  for (let i = 0; i < widths.length; i++) {
    points.push([edge(i, 1), bottom(i)]);
    if (i < widths.length - 1) points.push([edge(i + 1, 1), bottom(i)]);
  }
  points.push([edge(widths.length - 1, -1), bottom(widths.length - 1)]);
  for (let i = widths.length - 1; i >= 0; i--) {
    points.push([edge(i, -1), top(i)]);
    if (i > 0) points.push([edge(i - 1, -1), top(i)]);
  }
  const p = points.filter(
    (v, i) => i === 0 || v[0] !== points[i - 1][0] || v[1] !== points[i - 1][1],
  );
  if (p[p.length - 1][0] === p[0][0] && p[p.length - 1][1] === p[0][1]) p.pop();
  const corners = p.map((v, i) => {
    const a = p[(i + p.length - 1) % p.length],
      b = p[(i + 1) % p.length];
    const d1 = Math.hypot(a[0] - v[0], a[1] - v[1]),
      d2 = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const r = Math.min(radius, d1 / 2, d2 / 2);
    return {
      v,
      before: [
        v[0] + ((a[0] - v[0]) * r) / d1,
        v[1] + ((a[1] - v[1]) * r) / d1,
      ],
      after: [v[0] + ((b[0] - v[0]) * r) / d2, v[1] + ((b[1] - v[1]) * r) / d2],
    };
  });
  return (
    `M ${corners[0].before.join(" ")} ` +
    corners
      .map(
        (c) =>
          `L ${c.before.join(" ")} Q ${c.v.join(" ")} ${c.after.join(" ")}`,
      )
      .join(" ") +
    " Z"
  );
};
