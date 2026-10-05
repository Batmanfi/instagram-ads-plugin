# Style 2 — Classic-inspired editable draft

Created 2026-10-01 in a separate [Paper page](https://app.paper.design/file/01M3VF361K5SV4TAFHF5Q9C09D/p-2-0), named **Style 2 — Classic**. It contains the 1080×1920 editable master and a typography/editing guide with Regular, Medium and Bold comparison samples.

## Font choice

The working match is **Roboto Bold, weight 700, full width**, with −0.03 em tracking. It is an approximation of the Classic sans serif look, not a verified identification of Instagram's current proprietary font. [Meta's typography overview](https://www.meta.com/design-at-meta/blog/behind-instagrams-brand-evolution-movement-inclusivity-and-a-new-purpose/) confirms Instagram Sans in Stories but does not map the Classic picker label to a font. Paper reports Instagram Sans unavailable; Roboto 400/500/700 are available. The supplied local Roboto Bold TTF and its OFL license are preserved here for repeatable measurement.

## Starting design

Same exact example copy, emoji assets and explicit line breaks as Style 1. Font sizes: hook 62 px, label/CTA 52 px, support/proof 46 px. Row height 1.28 em. Center x=540; tops 150, 470, 620, 790, 960, 1170 and 1480 px. Top/side/bottom safe margins 150/90/280 px; minimum gap 28 px. Scenic still with 28% dark overlay.

Highlights use Style 1's overlapping padded line-box union with rounded convex/concave corners, remeasured for the wider font. These are inherited starting values for the draft, not measurements from a Classic-font screenshot. Padding/corners may be tuned manually. The hook measures about 891.66×272.8 px with the local Bold TTF. All seven outlines pass safe-area and gap checks.

## Manual editing

Select the named text layers to change text, font family, weight, size or tracking. Move the enclosing block for placement. Emoji images, background still and overlay are separate layers. Background colors use independent `--color-style-2-hook`, `--color-style-2-intro`, `--color-style-2-step-1`, `--color-style-2-step-2`, `--color-style-2-step-3`, `--color-style-2-proof` and `--color-style-2-cta` tokens. Change text color separately when switching fills.

After changing text, font, size or line breaks in Paper, ask Codex to read the updated rows through MCP and regenerate the continuous outline. Paper does not execute the generator automatically. `paper-map.json` records the groups, text/emoji rows, outlines and tokens for that handoff. Direct numeric metrics can be unavailable while this page is inactive; use Paper when the page is viewed, or the bundled-font browser measurements as a documented approximation.

For live geometry tuning, open `generated/highlight-editor.html` in a browser. Its embedded local bold font and emoji PNGs work without remote dependencies. Changes to text/tracking/padding/radii regenerate the background immediately; downloads preserve font family and weight. The editor does not write to Paper automatically.

```sh
node scripts/generate-instagram-highlights.mjs --input design/styles/style-2/input.json --output design/styles/style-2/generated
```

`input.json` holds the editable draft settings. `generated/paper-layout.json` holds measured line widths, geometry and Paper HTML. No cached Style 1 widths are reused. `verification.json` records font loading, exact copy, all seven outlines and live regeneration checks.

This is an editable design study, pending the user's tweaks. It is not yet registered as a production renderer preset; Style 1 remains the saved production style. Read the current Paper design before applying or saving Style 2 later, so manual edits are preserved.
