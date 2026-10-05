# Style 3 — Coral highlights (Paper draft)

Created 2026-10-03 from `IMG_20261003_185525_359.webp`. Status: **draft awaiting user tuning**. This is not a production preset and is not selected by the Remotion CLI yet.

[Editable Paper page](https://app.paper.design/file/01M3VF361K5SV4TAFHF5Q9C09D/p-4-0). Three artboards: editable 1080×1920 master, unchanged reference image, and editing guide. All 8 blocks, 17 text layers and 5 emoji image layers are separate. Each block contains editable text rows, emoji images and a generated joined SVG highlight. Color tokens are independent of Styles 1 and 2.

Starting type: full-width Roboto Bold 700, −0.01 em tracking; hook 52 px, intro/process 46 px, proof/CTA 49 px. Hook rows 57.6 px, intro 52.8 px, process 50.16 px, closing rows 52.8 px. These are visual approximations, not verified Instagram font identities or approved measurements. Colors sampled from the supplied image: coral #ED4957, pale pink #FEEBED, warm light text #FEECEB and black #000000. `draft-layout.json` records contour geometry, measured widths and initial positions. Reference copy is illustrative only and must not supply claims to future ads.

Edit named Text layers for wording, typography and tracking; move the complete block for placement. Change document tokens `--color-style-3-coral`, `--color-style-3-pale`, `--color-style-3-light` and `--color-style-3-ink` to change text and highlight colors. After edits change text widths, ask Codex to remeasure and regenerate highlights; Paper does not execute the generator automatically. `paper-map.json` maps all editable nodes; `paper-draft-snapshot.json` stores direct JSX, computed CSS, text reads and a passing copy audit. `paper-draft.png` is the reviewed draft export.

The background is a separate raster layer. `background-cleaned.png` was edited with built-in imagegen to remove baked text and highlights from a copy of the supplied image. Erased regions are reconstructed and the photo is not pixel-identical. The original WebP is archived unchanged. The exact cleanup prompt and generated source path are saved in `background-edit.json`.

When the user finishes tuning, read the current Paper text, styles, row widths, colors, emoji sizes and block positions directly. Preserve their edits while regenerating contours. Then implement and validate a separate Style 3 preset in the existing shared renderer. Follow the shared compact, above-center policy for new copy, unless the user approves a different policy. Do not treat these initial reference positions as universal layout values and do not change existing approved styles.

`../build-paper-drafts.mjs` reconstructs only the initial local draft records; it does not write to Paper or change production. Do not rerun it over a tuned snapshot. No video rendering was requested or performed for this draft.
