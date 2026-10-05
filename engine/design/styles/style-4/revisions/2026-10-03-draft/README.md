# Style 4 — Serif hook (Paper draft)

Created 2026-10-03 from `Screenshot_20261003-192122_Gallery.jpg`. Status: **draft awaiting user tuning**. This is not a production preset and is not selected by the Remotion CLI yet.

[Editable Paper page](https://app.paper.design/file/01M3VF361K5SV4TAFHF5Q9C09D/p-5-0). Three artboards: editable 1080×1920 master, original reference image cropped to its 9:16 photographic area, and editing guide. All 6 blocks, 13 text layers and 5 emoji image layers are separate. The original 1080×2340 screenshot is archived unchanged; reference display crops 210 px Gallery bars at top and bottom without stretching.

Starting type: Times New Roman Regular 400 hook, 76 px with 84 px line height; full-width Roboto Bold 700 process/CTA, 48 px with 55.2 px line height; zero tracking. Both families were confirmed available in Paper. These are visual approximations, not verified Instagram font identities or approved measurements. The hook/process are plain white; the CTA has a separate white joined highlight and black text. Document tokens `--color-style-4-white` and `--color-style-4-ink` are independent of approved styles. The separate Contrast layer starts at 25% black opacity. `draft-layout.json` records starting typography, widths and placement.

Edit named Text layers for copy, font, size and tracking. Move the complete block for placement and select each emoji image for sizing. Text is editable separately from the background. After the CTA text changes, ask Codex to remeasure it and regenerate its highlight; Paper does not execute code automatically. `paper-map.json` maps editable nodes; `paper-draft-snapshot.json` stores direct JSX, computed CSS, text reads and a passing copy audit. `paper-draft.png` is the reviewed export. Reference copy is illustrative only and must not supply claims to future ads.

The background is a separate raster layer. `background-cleaned.png` was edited with built-in imagegen to remove baked text, emoji and the CTA shape, and crop Gallery bars. Erased areas are reconstructed, so the scene is not pixel-identical. The unchanged source JPEG is archived alongside the draft. The exact prompt and generated source path are saved in `background-edit.json`.

When tuning is complete, read the current Paper typography, colors, row widths, emoji dimensions, overlay and block positions directly. Preserve the user’s edits. Implement a separate Style 4 preset in the shared renderer, with per-role fonts and plain highlights. Determine portable serif font loading/licensing at that stage; do not silently substitute a font. Apply the shared compact, above-center placement rule to new copy unless the user approves a different policy. Do not change approved Styles 1 or 2.

`../build-paper-drafts.mjs` reconstructs only initial local draft records and does not write to Paper or production. Do not rerun it over tuned snapshots. No video rendering was requested or performed.
