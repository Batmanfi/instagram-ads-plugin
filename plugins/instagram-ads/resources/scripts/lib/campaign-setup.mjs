import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeMusic } from "./music.mjs";

export const styles = ["style-1", "style-2", "style-3", "style-4"];
export const tracks = ["chill-sunday", "hush", "sunday-evening"];
export const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const choicesDigest = choices => sha256(JSON.stringify(canonical(choices)));
export const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
export const writeJson = (file, value, options) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", options);
const identifier = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9_-]*$/i.test(value);
const assert = (condition, message) => { if (!condition) throw Error(message); };

export function campaignDirectory(root, campaign) {
  assert(identifier(campaign), "Invalid campaign slug");
  const parent = path.join(root, "data", "campaigns");
  const directory = path.join(parent, campaign);
  if (fs.existsSync(directory)) {
    assert(!fs.lstatSync(directory).isSymbolicLink(), "Campaign directory must not be a symlink");
    assert(path.dirname(fs.realpathSync(directory)) === fs.realpathSync(parent), "Campaign must stay in data/campaigns");
  }
  return directory;
}

// The agent parses the actual document, including its headings/status metadata.
// This utility separates those fields; it never guesses which source words to drop.
export function splitParsedCopy(parsed) {
  assert(parsed.version === 1 && Array.isArray(parsed.ads) && parsed.ads.length, "Parsed copy must contain ads");
  const ids = new Set();
  const metadata = [], layoutAds = [];
  const ads = parsed.ads.map((ad, index) => {
    assert(identifier(ad.id) && !ids.has(ad.id), "Invalid or duplicate ad ID");
    assert(ad.title === undefined || typeof ad.title === "string", "Ad title must be text");
    assert(ad.status === undefined || typeof ad.status === "string", "Ad status must be text");
    ids.add(ad.id);
    assert(Array.isArray(ad.blocks) && ad.blocks.length, `No copy blocks for ${ad.id}`);
    const blockIds = new Set();
    const blocks = ad.blocks.map((block) => {
      assert(identifier(block.id) && !blockIds.has(block.id), `Invalid/duplicate block in ${ad.id}`);
      blockIds.add(block.id);
      assert(typeof block.text === "string" && block.text.trim(), `Empty copy in ${ad.id}/${block.id}`);
      if (block.role !== undefined) assert(["hook", "label", "support", "proof", "cta"].includes(block.role), "Unknown block role");
      return {id: block.id, text: block.text};
    });
    metadata.push({id: ad.id, number: index + 1, title: ad.title ?? `Ad ${index + 1}`, ...(ad.status !== undefined ? {status: ad.status} : {})});
    layoutAds.push({id: ad.id, blocks: ad.blocks.map((block, i) => ({id: block.id,
      styleRole: block.role ?? (i === 0 ? "hook" : i === blocks.length - 1 ? "cta" : block.id === "intro" ? "label" : block.id === "proof" ? "proof" : "support")}))});
    return {id: ad.id, blocks};
  });
  return {copy: {version: 1, ads}, metadata, layoutAds};
}

export function assertSetupReady(manifest, copyHash) {
  if (!manifest.setup) return; // Existing campaigns keep their approved behavior.
  assert(manifest.setup.status === "ready", "Campaign setup is pending. Submit its inline form before rendering.");
  assert(manifest.setup.copySha256 === copyHash, "Campaign copy changed after setup. Prepare a new setup for the revised copy.");
}

function pickBag(values, seed, index) {
  const round = Math.floor(index / values.length);
  return [...values].sort((a, b) => sha256(`${seed}/${round}/${a}`).localeCompare(sha256(`${seed}/${round}/${b}`)))[index % values.length];
}

export function resolveChoices({manifest, copy, copyHash, campaign, choices, musicTracks}) {
  assert(choices?.kind === "instagram-ad-campaign-setup" && choices.version === 1 && choices.demo === false, "Production requires a production form submission; demo choices are rejected");
  assert(manifest.setup && choices.requestId === manifest.setup.requestId, "Wrong or stale setup request");
  assert(choices.campaign === campaign && choices.copySha256 === copyHash && manifest.setup.copySha256 === copyHash, "Campaign/source copy mismatch");
  const ids = copy.ads.map(ad => ad.id);
  assert(JSON.stringify(choices.adIds) === JSON.stringify(ids), "Form ad IDs/order do not match source copy");
  assert(choices.adCount === ids.length && JSON.stringify(manifest.ads.map(ad => ad.id)) === JSON.stringify(ids), "Campaign ad count/order mismatch");
  assert(styles.includes(choices.style) || choices.style === "mix", "Unknown saved style");
  assert(["all", "none", "selected"].includes(choices.musicScope), "Unknown music scope");
  assert(Array.isArray(choices.musicAdIds), "Missing music selections");
  assert(new Set(choices.musicAdIds).size === choices.musicAdIds.length && choices.musicAdIds.every(id => ids.includes(id)), "Unknown or duplicate music ad ID");
  assert(choices.musicScope !== "all" || JSON.stringify(choices.musicAdIds) === JSON.stringify(ids), "All-ad music must include every ad in order");
  assert(choices.musicScope !== "none" || choices.musicAdIds.length === 0, "Silent scope cannot include music ads");
  const overrides = choices.overrides ?? [];
  assert(Array.isArray(overrides) && new Set(overrides.map(o => o.id)).size === overrides.length, "Invalid/duplicate per-ad overrides");
  const byId = new Map();
  for (const override of overrides) {
    assert(override && ids.includes(override.id), "Unknown override ad ID");
    assert(Object.keys(override).every(key => ["id", "style", "music", "track"].includes(key)), "Unknown per-ad override field");
    if (override.style !== undefined) assert(styles.includes(override.style), "Invalid per-ad style");
    if (override.music !== undefined) assert(typeof override.music === "boolean", "Invalid per-ad music switch");
    if (override.track !== undefined) assert(tracks.includes(override.track), "Invalid per-ad music track");
    byId.set(override.id, override);
  }
  const enabledIds = ids.filter(id => byId.get(id)?.music ?? choices.musicAdIds.includes(id));
  const audio = choices.audio;
  if (enabledIds.length) {
    assert(audio && Object.keys(audio).every(key => ["startTime", "volume", "fadeInSeconds", "fadeOutSeconds"].includes(key)), "Missing/invalid explicit audio settings");
    assert(choices.trackSelection === "random-balanced", "Unknown track selection policy");
  }
  for (const override of overrides) assert(override.track === undefined || enabledIds.includes(override.id), "A silent ad cannot have a track override");
  const digest = choicesDigest(choices);
  if (manifest.setup.status === "ready") {
    assert(manifest.setup.choicesSha256 === digest, "This form was already applied. New changes require an explicitly reopened setup.");
    return {manifest, alreadyApplied: true};
  }
  assert(manifest.setup.status === "pending", "Unknown setup status");
  let trackIndex = 0;
  const ads = manifest.ads.map((ad, index) => {
    const override = byId.get(ad.id);
    const style = override?.style ?? (choices.style === "mix" ? pickBag(styles, manifest.setup.requestId + "/style", index) : choices.style);
    const enabled = enabledIds.includes(ad.id);
    const track = enabled ? override?.track ?? pickBag(tracks, manifest.setup.requestId + "/music", trackIndex++) : undefined;
    const music = enabled ? {...audio, track} : false;
    if (enabled) normalizeMusic(music, musicTracks);
    // Reset only setup-controlled fields. Preserve exact copy and deliberate layouts.
    return {...ad, style, music};
  });
  const resolved = {...manifest, layoutMode: "compact", music: false, ads,
    setup: {...manifest.setup, status: "ready", choicesSha256: digest, appliedAt: new Date().toISOString(),
      styleSelection: choices.style, musicAdIds: enabledIds, trackSelection: enabledIds.length ? "random-balanced" : null}};
  delete resolved.style; // Each ad has its concrete saved preset, including Mix.
  return {manifest: resolved, alreadyApplied: false};
}

export function formConfig(root, campaign) {
  const directory = campaignDirectory(root, campaign);
  const manifest = readJson(path.join(directory, "manifest.json"));
  const copyFile = path.join(directory, "copy.json");
  const copy = readJson(copyFile), metadata = readJson(path.join(directory, "source-metadata.json"));
  assert(manifest.setup?.status === "pending", "Only pending campaigns can open a production setup form");
  const hash = sha256(fs.readFileSync(copyFile));
  assert(hash === manifest.setup.copySha256, "Copy changed since preparation; create a new request");
  return {kind: "instagram-ad-campaign-setup", version: 1, demo: false, campaign, requestId: manifest.setup.requestId,
    copySha256: hash, adCount: copy.ads.length, ads: copy.ads.map((ad, index) => ({id: ad.id, number: index + 1,
      title: metadata.ads.find(item => item.id === ad.id)?.title ?? `Ad ${index + 1}`}))};
}

export function generateForm(root, config, destination) {
  const template = fs.readFileSync(path.join(root, "tools/campaign-setup/form.template.html"), "utf8");
  assert(template.includes("__CAMPAIGN_CONFIG__"), "Form config marker missing");
  const script = fs.readFileSync(path.join(root, "tools/campaign-setup/form.js"), "utf8");
  const fragment = template.replace("__CAMPAIGN_CONFIG__", JSON.stringify(config).replaceAll("<", "\\u003c"))
    .replace("__FORM_SCRIPT__", () => script);
  assert(Buffer.byteLength(fragment) < 1_000_000, "Form exceeds inline size limit");
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, fragment);
  return path.resolve(destination);
}
