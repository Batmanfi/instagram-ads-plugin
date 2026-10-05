import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {campaignDirectory, splitParsedCopy, sha256, choicesDigest, readJson, writeJson, resolveChoices, formConfig, generateForm} from "./lib/campaign-setup.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);
const option = key => {
  const index = args.indexOf(key);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw Error(`Missing ${key}`);
  return args[index + 1];
};
const required = key => {const value = option(key); if (!value) throw Error(`Required: ${key}`); return value;};
const supported = {prepare: ["--copy", "--source", "--brand", "--source-url", "--snapshot", "--output"], form: ["--campaign", "--output"], apply: ["--campaign", "--choices"]};

try {
  if (!supported[command]) throw Error("Use prepare, form, or apply; see tools/campaign-setup/README.md");
  for (let index = 0; index < args.length; index += 2) {
    if (!supported[command].includes(args[index])) throw Error(`Unknown option ${args[index]}`);
    option(args[index]);
  }
  if (command === "prepare") {
    const source = path.resolve(required("--source")), parsed = readJson(path.resolve(required("--copy")));
    const sourceBytes = fs.readFileSync(source);
    const split = splitParsedCopy(parsed);
    const sourceUrl = option("--source-url"), snapshot = option("--snapshot");
    if (sourceUrl && !/^https:\/\/(docs\.google\.com|drive\.google\.com)\//.test(sourceUrl)) throw Error("Source URL must be the supplied Google document URL");
    if (sourceUrl && !snapshot) throw Error("Google Docs require the complete original document snapshot");
    const snapshotBytes = snapshot ? fs.readFileSync(path.resolve(snapshot)) : undefined;
    if (snapshotBytes) JSON.parse(snapshotBytes.toString("utf8"));
    const backgrounds = readJson(path.join(root, "data/backgrounds.json")).filter(item => item.suitableFor10Seconds === true && item.duration >= 10);
    if (!backgrounds.length) throw Error("No eligible continuous 10-second backgrounds");
    const brand = required("--brand").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    if (!brand) throw Error("Brand must produce a readable campaign slug");
    const date = new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
    const parent = path.join(root, "data/campaigns");
    fs.mkdirSync(parent, {recursive: true});
    let campaign, directory;
    for (let index = 1; ; index++) {
      campaign = `${brand}-${date}-${String(index).padStart(2, "0")}`;
      directory = campaignDirectory(root, campaign);
      try {fs.mkdirSync(directory); break;} catch (error) {if (error.code !== "EEXIST") throw error;}
    }
    const sourceName = `Original-Ad-Copy${path.extname(source) || ".txt"}`;
    fs.writeFileSync(path.join(directory, sourceName), sourceBytes, {flag: "wx"});
    let snapshotRecord;
    if (snapshot) {
      const bytes = snapshotBytes;
      fs.writeFileSync(path.join(directory, "google-document-snapshot.json"), bytes, {flag: "wx"});
      snapshotRecord = {filename: "google-document-snapshot.json", sha256: sha256(bytes)};
    }
    const copy = {...split.copy, source: `data/campaigns/${campaign}/${sourceName}`};
    writeJson(path.join(directory, "copy.json"), copy, {flag: "wx"});
    const copyHash = sha256(fs.readFileSync(path.join(directory, "copy.json")));
    const requestId = crypto.randomUUID();
    const manifest = {version: 1, layoutMode: "compact", defaultContrast: 0.28, safeMargins: {top: 150, side: 90, bottom: 280}, music: false,
      setup: {version: 1, status: "pending", requestId, copySha256: copyHash},
      ads: split.layoutAds.map((ad, index) => ({...ad, outputName: `${campaign}-${ad.id}`, fontPreset: "condensed-regular",
        background: {filename: backgrounds[index % backgrounds.length].filename, startTime: 0, cropPosition: [50, 50]}, music: false}))};
    writeJson(path.join(directory, "manifest.json"), manifest, {flag: "wx"});
    writeJson(path.join(directory, "source-metadata.json"), {version: 1, archivedAt: new Date().toISOString(), source: {filename: sourceName, sha256: sha256(sourceBytes),
      kind: sourceUrl ? "google-doc" : "attachment", ...(sourceUrl ? {url: sourceUrl} : {}), ...(snapshotRecord ? {snapshot: snapshotRecord} : {})}, ads: split.metadata}, {flag: "wx"});
    const output = option("--output") ? path.resolve(option("--output")) : path.join(directory, "campaign-setup.html");
    const form = generateForm(root, formConfig(root, campaign), output);
    console.log(JSON.stringify({campaign, directory, adCount: copy.ads.length, status: "awaiting setup choices", form,
      contentReference: `visualize${JSON.stringify({path: form})}`}, null, 2));
  } else {
    const campaign = required("--campaign"), directory = campaignDirectory(root, campaign);
    if (command === "form") {
      const output = option("--output") ? path.resolve(option("--output")) : path.join(directory, "campaign-setup.html");
      console.log(JSON.stringify({form: generateForm(root, formConfig(root, campaign), output)}, null, 2));
    } else {
      const lock = path.join(directory, ".setup-apply.lock");
      const handle = fs.openSync(lock, "wx");
      try {
      const copyFile = path.join(directory, "copy.json"), manifestFile = path.join(directory, "manifest.json");
      const choices = readJson(path.resolve(required("--choices")));
      const result = resolveChoices({manifest: readJson(manifestFile), copy: readJson(copyFile), copyHash: sha256(fs.readFileSync(copyFile)), campaign, choices,
        musicTracks: readJson(path.join(root, "data/music.json")).tracks});
      if (!result.alreadyApplied) {
        const record = path.join(directory, "setup-choices.json");
        if (fs.existsSync(record) && choicesDigest(readJson(record)) !== result.manifest.setup.choicesSha256) throw Error("Conflicting saved setup choices");
        writeJson(record, choices);
        const staging = path.join(directory, `manifest-${crypto.randomUUID()}.tmp`);
        writeJson(staging, result.manifest, {flag: "wx"});
        fs.renameSync(staging, manifestFile);
      }
      console.log(JSON.stringify({campaign, alreadyApplied: result.alreadyApplied, status: "ready", adCount: result.manifest.ads.length,
        selections: result.manifest.ads.map(ad => ({id: ad.id, style: ad.style, music: ad.music ? ad.music.track : false}))}, null, 2));
      } finally {fs.closeSync(handle); fs.unlinkSync(lock);}
    }
  }
} catch (error) {console.error(error.message); process.exitCode = 1;}
