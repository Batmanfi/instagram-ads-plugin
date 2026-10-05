# Style 4 — Serif hook (saved preset)

Created from `Screenshot_20261003-192122_Gallery.jpg` and saved on 2026-10-03 with the user's −2% headline tracking correction. Canonical preset: `data/styles/style-4/definition.json`. Select with `"style": "style-4"` in campaign/ad manifests or `--style style-4` in the existing utility.

[Editable Paper page](https://app.paper.design/file/01M3VF361K5SV4TAFHF5Q9C09D/p-5-0). Three artboards: editable 1080×1920 master, original reference image cropped to its 9:16 photographic area, and editing guide. All 6 blocks, 13 text layers and 5 emoji image layers are separate. The original 1080×2340 screenshot is archived unchanged; reference display crops 210 px Gallery bars at top and bottom without stretching.

Saved type: **Times New Roman Regular 400 hook at −0.02 em tracking**, 76 px with 84 px rows. Full-width bundled Roboto Bold 700 process/CTA at 48 px with 55.2 px rows and zero tracking. Hook/process are plain white with no highlight padding. CTA is black text on a joined white highlight with x/y padding .30/.25 em and outer/inner radii .20/.25 em. Paper's tightened headline rows were recentered as flex rows. Tokens `--color-style-4-white` and `--color-style-4-ink` are independent of other styles. The separate Contrast layer is now **28% black**, beneath all content, matching Styles 1/2. Initial `draft-layout.json` is historical only.

Edit named Text layers for copy, font, size and tracking. Move the complete block for placement and select each emoji image for sizing. Text is editable separately from the background. After the CTA text changes, ask Codex to remeasure it and regenerate its highlight; Paper does not execute code automatically. `paper-map.json` maps editable nodes; `paper-draft-snapshot.json` stores direct JSX, computed CSS, text reads and a passing copy audit. `paper-draft.png` is the reviewed export. Reference copy is illustrative only and must not supply claims to future ads.

The background is a separate raster layer. `background-cleaned.png` was edited with built-in imagegen to remove baked text, emoji and the CTA shape, and crop Gallery bars. Erased areas are reconstructed, so the scene is not pixel-identical. The unchanged source JPEG is archived alongside the draft. The exact prompt and generated source path are saved in `background-edit.json`.

The shared composition implements per-role fonts, tracking, plain process text and CTA contour geometry. `src/fonts.ts` loads Times New Roman explicitly through `local("Times New Roman"), local("TimesNewRomanPSMT")`, waits before measurement and fails if missing. This Mac's installed exact family was verified by rendering. Other machines must have the same family installed. The OS font file is not bundled or redistributed; reusable source packages must retain this requirement. Do not silently substitute another serif or rasterize the headline.

Current example copy/layout are separate `data/styles/style-4/reference-copy.json` and `reference-manifest.json`. `paper-approved-snapshot.json` contains direct CSS, JSX and text reads; `paper-approved.png` is the corrected darkened Paper export. Renderer previews at frames 0/150/299 and changed-copy QA are checked and archived with `verification.json`. Initial drafts remain in `revisions/2026-10-03-draft/`.

Safe margins: top/side/bottom 150/70/280 px, maximum width 940 px, font floor 44 px. New copy uses `data/layout/defaults.json`: measure loaded fonts and emoji, use 64 px preferred gaps with a 28 px minimum, center the group 151.26 px above midpoint and clamp inside both safe boundaries. Reference tops 276, 634, 800, 1024, 1188 and 1406 px are deliberate example placement, not universal coordinates. Read exact current Paper values for requested resaves, preserve user edits, and regenerate CTA outlines from fresh widths. Keep all four saved presets stable unless the user requests revising one; include their data/design folders in source packages.

```sh
npm run validate -- --campaign CAMPAIGN_SLUG --style style-4
npm run render -- --campaign CAMPAIGN_SLUG --id AD_ID --style style-4
npm run render:all -- --campaign CAMPAIGN_SLUG --style style-4
```

The guarded initial builder must not overwrite saved records. `../save-approved-style34.py` records this save from direct snapshots; refresh MCP reads before a deliberate resave. This style-save task exported QA stills, not final MP4 ads.
