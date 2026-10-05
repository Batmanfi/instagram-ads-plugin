# Short-ad spacing — content stays together

The user supplied a screenshot on 2026-10-03 and requested tighter grouping for short ads, with comfortable space between text boxes. The ad was matched exactly to OutboundPilot ad 06 in `data/campaigns/outboundpilot-style1-2026-10-01-01/`, recovering the support text hidden by the screenshot's playback control.

[Editable before/after and spacing guide in Paper](https://app.paper.design/file/01M3VF361K5SV4TAFHF5Q9C09D/p-3-0). Both masters have individually editable text, emoji images, block groups, joined SVG contours, scene and overlay. The screenshot playback control is omitted. Independent color tokens start with `--color-compact-ad06-`. Move a complete named block to edit spacing. Ask Codex to regenerate its contour after changing copy or typography; Paper does not execute the generator automatically.

The design was built and reviewed in Paper before implementing the layout rule in the existing renderer. Exact JSX/styles and text-layer reads are archived in `paper-snapshot.json` and `paper-text-audit.json`; `paper-map.json` records all editable layers. `source-screenshot.png` preserves the supplied screenshot unchanged. This reference's claims belong only to this demonstration, never to new campaign copy.

## Measurement and spacing rule

Font and highlights remain Style 1: Roboto Condensed Regular 400, −3% tracking, original 62/46/46/52 px fonts and explicit wraps. All four complete contours were remeasured after the bundled font loaded. Their total height is 633.76 px. The original automatic layout distributed unused safe area across three gaps of 285.4133 px. The new layout uses 64 px between outline edges.

| Block | Height | Original top | Compact top |
| --- | ---: | ---: | ---: |
| Hook | 272.80 | 150.00 | 150.00 |
| Support | 190.44 | 708.21 | 486.80 |
| Guarantee | 80.04 | 1184.07 | 741.24 |
| CTA | 90.48 | 1549.52 | 885.28 |

The compact CTA ends at 975.76 px, leaving spare scenery below. No word, emoji, wrap, font size, contour padding or margin changed.

`data/layout/defaults.json` saves the global layout policy; `scripts/lib/block-layout.mjs` implements it. For automatic layouts, use measured complete box heights and calculate the available gap from the vertical safe area, then cap it at 64 px. Dense copy can reduce the gap toward 28 px. If all boxes cannot fit with 28 px gaps, reject the layout instead of shrinking text. Stack from the safe top; spare space remains below. One block has no inter-block gap. The CTA follows the preceding box and is not anchored separately to the bottom.

The policy applies to Style 1, Style 2 and unnamed automatic layouts. New campaign manifests should save `"layoutMode": "compact"`; the renderer also defaults to it. Omit every block's `y` for automatic positioning. All explicit `y` values preserve a manual layout; mixed automatic/manual placements are rejected. Explicit `"layoutMode": "distributed"` reproduces the old spacing when requested. Future automatic rerenders use the updated policy; archived campaign files and delivered MP4s were not changed.

## Verification

`verification.json` records TypeScript, six layout tests, 15 renderer checks, exact-copy/Paper text audits, emoji preservation, safe margins, and beginning/middle/end visual reviews. The live editor's geometry and text/tracking regeneration checks passed. `updated-campaign-measurements.json` confirms all 15 previous Style 1 ads still fit under the new policy, including dense examples with gaps of 38.86–49.64 px. This report was written here without overwriting archived campaign measurements.

The renderer's checked frames are `remotion-0.png`, `remotion-150.png` and `remotion-299.png`. `paper-after.png` is the final Paper preview. The standard production CLI also validated ad 06 with compact spacing; its report and resolved props are archived alongside this study. No new finished MP4 campaign was requested or exported.

```sh
npm run check
node --test scripts/lib/block-layout.test.mjs
npm run qa:checks
node scripts/measure-style1-campaign.mjs outboundpilot-style1-2026-10-01-01 --output work/compact-spacing-measurements.json
node scripts/generate-instagram-highlights.mjs --input design/layout/compact-spacing-2026-10-03/input.json --output design/layout/compact-spacing-2026-10-03/generated --measure-local
node scripts/verify-instagram-highlight-editor.mjs design/layout/compact-spacing-2026-10-03/generated/highlight-editor.html
```

Include `data/layout/`, the shared layout module, both named style folders and this demonstration in reusable source packages. Future copy remains authoritative and must be measured afresh.
