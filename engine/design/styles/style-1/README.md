# Style 1 — approved native Story highlights

Saved at the user's request on 2026-10-01. The canonical configuration is `data/styles/style-1/definition.json`. Both the live generator and the existing Remotion composition use its geometry. Change the saved style only when explicitly requested; use a new named style for future variations.

## Design specification

- 1080×1920, 30 fps, 300 frames, continuous muted scenic video; every block visible throughout.
- Local `public/fonts/RobotoCondensed-Regular.ttf`, weight 400, **−0.03 em letter spacing**, **1.28 em row height**. No synthetic stretch or substitute fonts.
- Safe margins: top 150 px, sides 90 px, bottom 280 px; block gaps ≥28 px; max outline width 900 px; default black video overlay 28%.
- Centered, phrase-wrapped text with one union contour per block. Padded line boxes overlap; both convex and concave corners use circular arcs. Adjacent width differences ≤0.10 em merge without narrowing a line.

| Role / geometry preset | Font px | Fill | Horizontal pad em | Vertical pad em | Outer radius em | Inner radius em |
|---|---:|---|---:|---:|---:|---:|
| Hook / hook | 62 | Black | .36 | .28 | .24 | .24 |
| Intro label / label | 52 | Black | .22 | .23 | .20 | .20 |
| Support / white | 46 | White | .35 | .15 | .18 | .22 |
| Proof / black | 46 | Black | .36 | .23 | .22 | .24 |
| CTA / black | 52 | Black | .36 | .23 | .22 | .24 |

Multiply em values by the block font size for pixels. Text is white on black, black on white. Emoji graphemes retain the local deterministic PNGs at one font-size square. All font loading is awaited before measuring actual DOM rows at the display tracking.

## Reference archive

`data/styles/style-1/reference-copy.json` stores the exact example copy, separate from `reference-manifest.json` (explicit line breaks, font sizes, x/y, fills, role mapping). `reference-input.json` retains the exact measured Paper line-width snapshot. For those example widths the hook is 774.64×272.8 px. Its screenshot measurement is approximately 774×273 px; these are calibrated visual matches, not Instagram's internal values.

This folder preserves the source screenshot, measurement report, generated geometry/SVGs and `highlight-editor.html`, a portable browser editor with embedded fonts and emoji images. Open it locally to edit text, spacing, padding, radius and fill. These experiments do not overwrite the canonical style or automatically update Paper.

Reference tops: hook 150, label 470, support 620/790/960, proof 1170, CTA 1480 px, all centered at x=540. These reproduce the exact seven-block example. Future automatic layouts use `data/layout/defaults.json`: keep measured complete highlights together with 64 px preferred gaps, reducing to at least 28 px for dense copy. Center the group 151.26 px above the canvas midpoint (center ≈809 px); clamp taller groups inside both safe boundaries. Leave more spare space below for Instagram controls; do not push a short ad's CTA to the bottom. Set `"layoutMode": "compact"` in new manifests. Explicit manual `y` on every block preserves the saved reference and other deliberate layouts. Never reuse example claims or cached widths for new ads.

## Production selection

Say “create these ads in style 1” with the new authoritative copy. The project `AGENTS.md` preserves this routing in future chats. Archive each new campaign normally; set `"style": "style-1"` at the manifest root or ad level. CLI `--style style-1` overrides that selection for one run and is captured in each resolved ad's props.

Each block can specify `styleRole`: `hook`, `label`, `support`, `proof`, `cta`. Without one, the first block is the hook, the last CTA, `intro` is a label, `proof` is proof, and other middle blocks are support. Set roles explicitly for differently named blocks. Font family, weight, tracking, line height and padding/corners come from Style 1. Legacy block padding/radius/font-family controls do not override those style settings. `fontSize`, `lines`, `highlight`, `maxWidth`, `x` and `y` remain explicit layout controls; deliberate copy-fit changes should be recorded and inspected, with font sizes ≥44 px. Do not auto-shrink, rewrite or omit text.

```sh
npm run check
npm run qa:checks
npm run validate -- --campaign CAMPAIGN_SLUG --style style-1
npm run render -- --campaign CAMPAIGN_SLUG --id AD_ID --style style-1
npm run render:all -- --campaign CAMPAIGN_SLUG --style style-1
node scripts/generate-instagram-highlights.mjs --input data/styles/style-1/reference-input.json
```

After editing text or size in generator input, pass `--measure-local` or replace cached widths with freshly read Paper metrics. For Paper edits, re-read text/geometry through MCP and regenerate the background; color tokens remain directly editable. See `design/instagram-highlight/README.md` and `paper-map.json` for the handoff.

Selecting no named style preserves the prior rendering behavior. Saving this preset does not request or produce a new production campaign.
