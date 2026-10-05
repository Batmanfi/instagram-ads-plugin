import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd(),
  demo = JSON.parse(fs.readFileSync("data/demo.json", "utf8"));
const safeMargins = { top: 150, bottom: 280, side: 90 };
const styleManifest = JSON.parse(fs.readFileSync("data/styles/style-1/reference-manifest.json", "utf8"));
const styleCopy = JSON.parse(fs.readFileSync("data/styles/style-1/reference-copy.json", "utf8"));
const styleReference = {...styleManifest.ads[0], blocks: styleManifest.ads[0].blocks.map((b, i) => ({...b, text: styleCopy.ads[0].blocks[i].text}))};
const style2Manifest = JSON.parse(fs.readFileSync("data/styles/style-2/reference-manifest.json", "utf8"));
const style2Copy = JSON.parse(fs.readFileSync("data/styles/style-2/reference-copy.json", "utf8"));
const style2Reference = {...style2Manifest.ads[0], blocks: style2Manifest.ads[0].blocks.map((b, i) => ({...b, text: style2Copy.ads[0].blocks[i].text}))};
const compactReference = JSON.parse(fs.readFileSync("design/layout/compact-spacing-2026-10-03/reference-ad.json", "utf8"));
const referenceFor = (style) => {
  const manifest = JSON.parse(fs.readFileSync(`data/styles/${style}/reference-manifest.json`, "utf8"));
  const copy = JSON.parse(fs.readFileSync(`data/styles/${style}/reference-copy.json`, "utf8"));
  return {...manifest.ads[0], blocks: manifest.ads[0].blocks.map((b, i) => ({...b, text: copy.ads[0].blocks[i].text}))};
};
const style3Reference = referenceFor("style-3");
const style4Reference = referenceFor("style-4");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const result = [];
const seven = {
  ...demo,
  id: "seven-block-qa",
  blocks: [
    "Template test only",
    "Four offer lines test the layout.",
    "A second process block.",
    "Another short support block.",
    "A proof block placeholder.",
    "Production copy is pending.",
    "CTA position test",
  ].map((text, i) => ({
    id: `block-${i}`,
    text,
    fontSize: i === 0 ? 62 : 52,
    highlight: i > 0 && i < 4 ? "white" : "black",
  })),
};
const cases = [
  ["style-3-reference", style3Reference, true],
  ["style-3-changed-copy", {...style3Reference, blocks: [{id: "hook", text: "New supplied wording"}, {id: "proof", text: "A short supplied proof"}, {id: "cta", text: "Book your call 👇"}]}, true],
  ["style-3-copy-fit-guard", {...style3Reference, blocks: [{id: "hook", text: "Long supplied copy ".repeat(160)}]}, false],
  ["style-4-reference", style4Reference, true],
  ["style-4-changed-copy", {...style4Reference, blocks: [{id: "hook", text: "New supplied headline"}, {id: "step-1", text: "📌 Short supplied process"}, {id: "cta", text: "Book your call 👇"}]}, true],
  ["style-4-copy-fit-guard", {...style4Reference, blocks: [{id: "hook", text: "Long supplied copy ".repeat(160)}]}, false],
  ["short-ad-compact", compactReference, true],
  ["short-ad-distributed", {...compactReference, layoutMode: "distributed"}, true],
  ["single-block-compact", {...styleReference, blocks: [{id: "hook", text: "One short supplied block"}]}, true],
  ["mixed-manual-positions", {...compactReference, blocks: compactReference.blocks.map((b, i) => i === 0 ? {...b, y: 150} : b)}, false],
  ["style-2-reference", style2Reference, true],
  ["style-2-changed-copy", {...style2Reference, blocks: [{id: "hook", text: "New supplied wording"}, {id: "cta", text: "Book your call 👇"}]}, true],
  ["style-2-copy-fit-guard", {...style2Reference, blocks: [{id: "hook", text: "Long supplied copy ".repeat(160)}]}, false],
  ["style-1-reference", styleReference, true],
  ["style-1-changed-copy", {...styleReference, blocks: [{id: "hook", text: "New supplied wording", lines: ["New supplied wording"]}, {id: "cta", text: "Book your call 👇"}]}, true],
  ["style-1-exact-copy-guard", {...styleReference, blocks: [{id: "hook", text: "Exact supplied copy", lines: ["Altered supplied copy"]}]}, false],
  ["style-1-copy-fit-guard", {...styleReference, blocks: [{id: "hook", text: "Long supplied copy ".repeat(160)}]}, false],
  ["seven-block-auto-layout", seven, true],
  [
    "long-copy-readability",
    {
      ...demo,
      blocks: [
        {
          id: "long",
          text: "This is a deliberately long copy-fit test. ".repeat(80),
          fontSize: 52,
          maxWidth: 850,
        },
      ],
    },
    false,
  ],
  [
    "manual-lines-preserve-copy",
    {
      ...demo,
      blocks: [
        {
          id: "altered",
          text: "Exact supplied copy.",
          lines: ["Edited supplied copy."],
        },
      ],
    },
    false,
  ],
  [
    "bottom-safe-area",
    {
      ...demo,
      blocks: [{ id: "bottom", text: "CTA outside safe area", y: 1800 }],
    },
    false,
  ],
];
for (const [name, ad, shouldPass] of cases) {
  let passed = true,
    message = "";
  try {
    const inputProps = { ad, safeMargins };
    const composition = await selectComposition({
      serveUrl,
      id: "InstagramNativeAd",
      inputProps,
    });
    for (const frame of ["short-ad-compact", "style-3-reference", "style-4-reference"].includes(name) ? [0, 150, 299] : [0]) await renderStill({
      serveUrl,
      composition,
      inputProps,
      frame,
      output: path.join(root, "work", frame === 0 ? `${name}.png` : `${name}-${frame}.png`),
    });
  } catch (e) {
    passed = false;
    message = e.message;
  }
  if (passed !== shouldPass)
    throw Error(`${name}: unexpected result ${message}`);
  result.push({
    name,
    result: shouldPass ? "render passed" : "rejected as expected",
    message,
  });
}
fs.writeFileSync(
  "work/smoke-checks.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
