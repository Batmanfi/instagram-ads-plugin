# Style 2 — saved Classic treatment

Saved on 2026-10-03 after the user manually tuned the [Style 2 — Classic Paper page](https://app.paper.design/file/01M3VF361K5SV4TAFHF5Q9C09D/p-2-0) and confirmed **−1% letter spacing** matches the reference. This is now an opt-in production preset in the existing InstagramNativeAd composition. Say “create these ads in style 2” with new copy.

## Saved typography and layout

Use the bundled full-width **Roboto Bold 700**, `public/fonts/Roboto-Bold.ttf`, with −0.01 em tracking. Preserve hook 62 px, label/CTA 52 px, support/proof 46 px and 1.28 em row height. This records the user's approved visual match; the exact proprietary Instagram Classic font identity remains unverified. The earlier font research is archived with the draft in `revisions/2026-10-01-draft/`.

Canonical settings are `data/styles/style-2/definition.json`. Canvas: 1080×1920; production duration: 300 frames at 30 fps. Safe margins: top 150, sides 70, bottom 280 px; maximum outline width 940 px; minimum block gap 28 px; font floor 44 px. The 70 px side margins preserve the original 62 px hook and its explicit wraps after loosening tracking. Its Paper outline is 930.64×272.8 px. Reference blocks center at x≈540 with tops 150, 470, 620, 790, 960, 1170 and 1480 px. Keep the scenic background and 28% dark overlay as the reference treatment.

## Joined highlights

All seven backgrounds were regenerated from current Paper text widths, including the fixed-size emoji layers. Each block has one opaque SVG contour: overlapping padded line boxes joined with rounded outward and inward steps, using the same geometry algorithm as Style 1. Geometry is saved independently for Style 2.

| Role/preset | Horizontal padding | Vertical padding | Row height | Outer radius | Inner radius |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hook / black | .36 | .28 | 1.28 | .24 | .24 |
| Label / black | .22 | .23 | 1.28 | .20 | .20 |
| Support / white | .35 | .15 | 1.28 | .18 | .22 |
| Proof or CTA / black | .36 | .23 | 1.28 | .22 | .24 |

All values are em, multiplied by each block's font size. Merge threshold is .10 em. Font loading must finish before measuring. New copy must be measured afresh, including tracking and emoji widths; do not reuse cached reference widths, claims or a fixed seven-block structure. Deliberate copy-fit changes belong in the campaign layout and require visual QA.

## Editable Paper master

Text, emojis, enclosing block groups, scenic still and overlay remain separate editable layers. Select a named text layer to change wording, font or tracking; move the complete block for placement. Background colors are controlled through independent Style 2 color tokens: `--color-style-2-hook`, `--color-style-2-intro`, `--color-style-2-step-1`, `--color-style-2-step-2`, `--color-style-2-step-3`, `--color-style-2-proof` and `--color-style-2-cta`. Change text color separately when switching fills.

After editing copy, font or wrapping, ask Codex to read the current Paper rows and regenerate their backgrounds. Paper does not run this code automatically. `paper-map.json` maps the groups, rows, emoji layers and regenerated outlines. `paper-approved-snapshot.json` captures the final JSX and computed styles, including −0.01 em on every text layer. One CTA row previously used −1 px; it was normalized to the user's −1% preference.

## Local editor and reference archive

Open `generated/highlight-editor.html` for live geometry tuning. It embeds the local Bold font and emoji PNGs and immediately regenerates backgrounds for text, tracking, padding or radius changes. Download SVGs or block settings from it. The editor does not write to Paper automatically.

```sh
node scripts/generate-instagram-highlights.mjs --input data/styles/style-2/reference-input.json --output design/styles/style-2/generated
node scripts/verify-instagram-highlight-editor.mjs design/styles/style-2/generated/highlight-editor.html
```

`input.json` mirrors the saved reference input. `generated/paper-layout.json` records exact Paper widths and SVG geometry; local browser measurement differs by less than 1 px for these outlines. Use `--measure-local` after changing copy without fresh Paper metrics. The four emoji assets are included in copy/layout and their measured width. Reference copy and production layout are stored separately in `data/styles/style-2/reference-copy.json` and `reference-manifest.json`; the reference is illustrative and must not supply claims to new campaigns.

`verification.json` records the Paper review, copy audit, generated geometry, live editor checks and renderer checks. `remotion-reference-preview.png` is the reviewed renderer still. The October 1 draft is preserved in `revisions/2026-10-01-draft/`; the saved Style 1 preset and previous campaigns remain unchanged.

## Production selection

Future automatic placement follows `data/layout/defaults.json`: measured complete highlight boxes use 64 px preferred gaps, reducing only as needed to the 28 px minimum. Center the group 151.26 px above the canvas midpoint (center ≈809 px), matching the user's Paper edit; clamp taller groups inside both safe boundaries. Spare canvas surrounds the group with extra room below for Instagram controls, so short copy stays together. Save `"layoutMode": "compact"` in new campaign manifests; the renderer also defaults to compact. Explicit `y` on every block preserves the saved example and manual edits. Font and highlight geometry remain the approved Style 2 preset. The [short-ad comparison](https://app.paper.design/file/01M3VF361K5SV4TAFHF5Q9C09D/p-3-0) demonstrates the policy using Style 1; it applies to both styles.

Persist `"style": "style-2"` at the campaign-manifest root or each ad, with role-specific layout as needed. Explicit CLI selection:

```sh
npm run validate -- --campaign CAMPAIGN_SLUG --style style-2
npm run render -- --campaign CAMPAIGN_SLUG --id AD_ID --style style-2
npm run render:all -- --campaign CAMPAIGN_SLUG --style style-2
```

Use the existing campaign archival, exact-copy audit, rendering and delivery workflow in AGENTS.md. The saved preset is stable: read the latest Paper edits when the user requests revising or resaving it, and preserve those edits during regeneration. Include both named style folders in reusable source ZIPs.
