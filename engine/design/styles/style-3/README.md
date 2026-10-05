# Style 3 — Coral highlights (saved preset)

Created from `IMG_20261003_185525_359.webp` and approved on 2026-10-03. Canonical preset: `data/styles/style-3/definition.json`. Select with `"style": "style-3"` in a campaign/ad manifest or `--style style-3` in the existing render utility.

[Editable Paper page](https://app.paper.design/file/01M3VF361K5SV4TAFHF5Q9C09D/p-4-0). Three artboards: editable 1080×1920 master, unchanged reference image, and editing guide. All 8 blocks, 17 text layers and 5 emoji image layers are separate. Each block contains editable text rows, emoji images and a generated joined SVG highlight. Color tokens are independent of Styles 1 and 2.

Saved type: full-width bundled Roboto Bold 700, −0.01 em tracking; hook 52 px, intro/process 46 px, proof/CTA 49 px. Hook rows 57.6 px, intro 52.8 px, process 50.16 px, closing rows 52.8 px. The font is an approved visual match; Instagram's original font identity remains unverified. Colors: coral #ED4957 hook, black intro/process, pale pink #FEEBED proof/CTA; warm light #FEECEB text on hook/process and coral text on closing blocks. Role geometry (em): hook x/y padding .36/.22, label .28/.20, support/proof/CTA .28/.23; outer/inner radii .25/.25. Preserve these independently from Styles 1/2. Current settings are read from Paper and stored in the saved definition; `draft-layout.json` is historical initial construction data. Reference copy supplies no claims to new ads.

Edit named Text layers for wording, typography and tracking; move the complete block for placement. Change document tokens `--color-style-3-coral`, `--color-style-3-pale`, `--color-style-3-light` and `--color-style-3-ink` to change text and highlight colors. After edits change text widths, ask Codex to remeasure and regenerate highlights; Paper does not execute the generator automatically. `paper-map.json` maps all editable nodes; `paper-draft-snapshot.json` stores direct JSX, computed CSS, text reads and a passing copy audit. `paper-draft.png` is the reviewed draft export.

The background is a separate raster layer. `background-cleaned.png` was edited with built-in imagegen to remove baked text and highlights from a copy of the supplied image. Erased regions are reconstructed and the photo is not pixel-identical. The original WebP is archived unchanged. The exact cleanup prompt and generated source path are saved in `background-edit.json`.

The shared renderer now implements this preset, measuring each new line after the bundled font loads, including tracking and emoji widths, then regenerating joined outlines. Both Paper and production use a 28% black overlay beneath all text/highlights, matching Styles 1/2. Safe margins: 150/70/280 px, max outline 940 px, font floor 44 px. New ads use the compact policy in `data/layout/defaults.json`: preferred 64 px gaps, minimum 28 px, group centered 151.26 px above midpoint and clamped within safe margins. Manual reference tops remain 276, 529, 629, 780, 981, 1132, 1337 and 1495 px. Do not use those positions or cached widths for other copy.

Current exact example copy and layout are separate `data/styles/style-3/reference-copy.json` and `reference-manifest.json`. `paper-approved-snapshot.json` contains direct current CSS, JSX and text reads; `paper-approved.png` is the current darkened Paper export. `remotion-0.png`, `remotion-150.png` and `remotion-299.png` are checked production previews using eligible scenic footage. `verification.json` records checks. Initial draft files are preserved in `revisions/2026-10-03-draft/`.

For future revisions, use `paper-map.json` to read exact current rows, colors, emoji dimensions and CSS through MCP, preserving edits during outline regeneration. Keep the saved preset stable unless the user explicitly asks to revise it. Include all four data/design style folders in reusable source packages.

```sh
npm run validate -- --campaign CAMPAIGN_SLUG --style style-3
npm run render -- --campaign CAMPAIGN_SLUG --id AD_ID --style style-3
npm run render:all -- --campaign CAMPAIGN_SLUG --style style-3
```

`../build-paper-drafts.mjs` is guarded against overwriting saved styles. `../save-approved-style34.py` records this specific save from direct snapshots; refresh MCP reads before a deliberate resave. No final MP4 production was requested in this style-save task; only renderer QA stills were exported.
