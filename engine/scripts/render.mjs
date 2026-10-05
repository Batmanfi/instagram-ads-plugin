import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {loadRuntime,verifyAssets,inventoryAssets,stagePublic,fontIdentity,safeFile,verifyFonts} from './lib/portable-runtime.mjs';
import style1 from "../data/styles/style-1/definition.json" with {type: "json"};
import style2 from "../data/styles/style-2/definition.json" with {type: "json"};
import style3 from "../data/styles/style-3/definition.json" with {type: "json"};
import style4 from "../data/styles/style-4/definition.json" with {type: "json"};
import layoutPolicy from "../data/layout/defaults.json" with {type: "json"};
import { resolveMusic, normalizeMusic } from "./lib/music.mjs";
import { assertSetupReady, sha256 } from "./lib/campaign-setup.mjs";
const namedStyles = {"style-1": style1, "style-2": style2, "style-3": style3, "style-4": style4};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const args = process.argv.slice(2),
  option = (key) => {
    const i = args.indexOf(key);
    if (i < 0) return undefined;
    if (!args[i + 1] || args[i + 1].startsWith("--"))
      throw Error(`Missing value for ${key}`);
    return args[i + 1];
  };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error(`${cmd}: ${r.stderr || r.stdout}`);
  return r.stdout;
};
const booleanFlags=new Set(['--all','--validate','--qa-output','--dry-run','--no-music','--demo']);
const valueFlags=new Set(['--runtime','--campaign','--style','--music','--music-start','--music-volume','--music-fade-in','--music-fade-out','--id','--exclude','--font','--background']);
const seenFlags=new Set();
for(let i=0;i<args.length;i++){
  const flag=args[i];if(!booleanFlags.has(flag)&&!valueFlags.has(flag))throw Error(`Unknown renderer option: ${flag}`);
  if(seenFlags.has(flag))throw Error(`Duplicate renderer option: ${flag}`);seenFlags.add(flag);
  if(valueFlags.has(flag)){option(flag);i++;}
}
const probe = (p) =>
  JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      p,
    ]),
  );
const isDemo = args.includes("--demo"),
  validateOnly = args.includes("--validate");
const campaign = option("--campaign");
const styleOverride = option("--style");
const musicTrack = option("--music"), noMusic = args.includes("--no-music");
const musicOverrides = {};
for (const [flag, key] of [["--music-start", "startTime"], ["--music-volume", "volume"],
  ["--music-fade-in", "fadeInSeconds"], ["--music-fade-out", "fadeOutSeconds"]]) {
  const value = option(flag);
  if (value !== undefined) musicOverrides[key] = Number(value);
}
// Catch contradictory run instructions before any asset writes or rendering.
if (noMusic && (musicTrack !== undefined || Object.keys(musicOverrides).length))
  throw Error("--no-music cannot be combined with music options");
if (styleOverride !== undefined && !Object.hasOwn(namedStyles, styleOverride)) throw Error(`Unknown style: ${styleOverride}`);
if (campaign && !/^[a-z0-9][a-z0-9_-]*$/i.test(campaign)) throw Error("Invalid campaign folder name");
const runtime=loadRuntime(option('--runtime'),root);
const dataDir = runtime.campaignDir;
const manifest = read(`${dataDir}/manifest.json`),
  copy = read(`${dataDir}/copy.json`),
  presets = read(path.join(root,"data/font-presets.json"));
if (!isDemo) assertSetupReady(manifest, sha256(fs.readFileSync(`${dataDir}/copy.json`)));
const qaOutput = args.includes("--qa-output");
if (qaOutput && manifest.qaOnly !== true) throw Error("--qa-output requires an explicitly marked QA campaign");
if(runtime.mode!=='job'&&manifest.qaOnly!==true)throw Error('This development engine only runs explicitly marked synthetic QA campaigns outside the authorized job workflow');
if(runtime.mode==='job'&&['--style','--music','--music-start','--music-volume','--music-fade-in','--music-fade-out','--no-music','--font','--background'].some(flag=>seenFlags.has(flag)))throw Error('Job renders cannot override submitted per-ad choices');
if(isDemo)throw Error('Portable QA uses explicit campaign copy; the legacy --demo shortcut is disabled');
if (manifest.qaOnly === true && !qaOutput && !validateOnly && runtime.mode!=='job') throw Error("QA campaigns cannot write production outputs; use --qa-output");
const identifier = (s, name) => {
  if (typeof s !== "string" || !/^[a-z0-9][a-z0-9_-]*$/i.test(s))
    throw Error(`Invalid ${name}: ${s}`);
};
const number = (v, min, max, name) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error(`Invalid ${name}: ${v}`);
};
if (
  manifest.version !== 1 ||
  copy.version !== 1 ||
  !Array.isArray(manifest.ads) ||
  !Array.isArray(copy.ads)
)
  throw Error("Unsupported or malformed manifest/copy.");
for (const [key, max] of [
  ["top", 800],
  ["bottom", 800],
  ["side", 400],
])
  number(manifest.safeMargins?.[key], 0, max, `safeMargins.${key}`);
number(manifest.defaultContrast, 0, 0.5, "defaultContrast");
if (!isDemo && !copy.ads.length) {
  console.error(
    "COPY FILE REQUIRED: no supplied ads. Final production has not started. Attach authoritative copy; QA demo is separate.",
  );
  process.exitCode = 2;
} else {
  const ids = new Set(),
    outputs = new Set();
  for (const a of copy.ads) {
    identifier(a.id, "ad id");
    if (ids.has(a.id)) throw Error(`Duplicate ad ID: ${a.id}`);
    ids.add(a.id);
  }
  const selectedId = option("--id");
  if (!isDemo && !validateOnly && !args.includes("--all") && !selectedId)
    throw Error("Choose --id AD_ID or --all.");
  if (selectedId && !ids.has(selectedId))
    throw Error(`Ad not found: ${selectedId}`);
  for (const a of manifest.ads) {
    if (!ids.has(a.id)) throw Error(`Layout has no matching copy: ${a.id}`);
  }
  if (new Set(manifest.ads.map((a) => a.id)).size !== manifest.ads.length)
    throw Error("Duplicate manifest ID.");
  const ads = isDemo
    ? [read(path.join(root,"data/demo.json"))]
    : copy.ads
        .filter((a) => (!selectedId || a.id === selectedId) && !(option("--exclude") ?? "").split(",").includes(a.id))
        .map((a) => {
          const layout = manifest.ads.find((l) => l.id === a.id);
          if (!layout) throw Error(`No layout manifest for ${a.id}`);
          if (
            !Array.isArray(a.blocks) ||
            !a.blocks.length ||
            new Set(a.blocks.map((b) => b.id)).size !== a.blocks.length
          )
            throw Error(`Invalid ordered copy blocks for ${a.id}`);
          if (
            !Array.isArray(layout.blocks) ||
            layout.blocks.length !== a.blocks.length ||
            layout.blocks.some((b, i) => b.id !== a.blocks[i].id)
          )
            throw Error(
              `Layout blocks must match copy block order for ${a.id}`,
            );
          return {
            ...layout,
            blocks: a.blocks.map((b, i) => {
              identifier(b.id, "block id");
              if (typeof b.text !== "string" || !b.text.trim())
                throw Error(`Empty copy ${a.id}/${b.id}`);
              if ("text" in layout.blocks[i])
                throw Error("Keep text exclusively in copy.json");
              return { ...layout.blocks[i], text: b.text };
            }),
          };
        });
  const assets=verifyAssets(runtime),inventory=inventoryAssets(runtime,assets),fonts=verifyFonts(root);
  const needsSerif=ads.some(ad=>(styleOverride??ad.style??manifest.style)==='style-4'||ad.blocks.some(b=>b.fontFamily==='Times New Roman'));
  if(needsSerif&&!runtime.serifFontFile)throw Error('Style 4 requires an explicit installed Times New Roman Regular .ttf in serifFontFile; no font fallback');
  const serif=needsSerif?fontIdentity(runtime.serifFontFile):null;
  if(args.includes('--dry-run')) {
    console.log(JSON.stringify({status:'portable preflight passed',writesPerformed:false,engineRoot:root,runtime,assets:{id:assets.id,files:assets.files,manifestSha256:assets.manifestSha256},inventory,fonts,serif,adCount:ads.length},null,2));
    process.exit(0);
  }
  const {bundle}=await import('@remotion/bundler');
  const {selectComposition,renderMedia,renderStill}=await import('@remotion/renderer');
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")+`-${crypto.randomUUID().slice(0,8)}`,
    work = path.join(runtime.workRoot, stamp);
  fs.mkdirSync(work, { recursive: true });
  const checkpoint=value=>{const file=path.join(work,'report.json'),temporary=file+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');const fd=fs.openSync(temporary,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temporary,file);};
  const publicDir=stagePublic(runtime,work,assets,serif);
  fs.mkdirSync(path.join(work,'tmp'),{recursive:true});process.env.TMPDIR=path.join(work,'tmp');
  const report = {
    status: isDemo ? "QA only — production copy missing" : manifest.qaOnly===true ? "QA only — authorized synthetic campaign" : "production",
    campaign: campaign ?? "legacy",
    copySource: copy.source,
    copySha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(`${dataDir}/copy.json`))
      .digest("hex"),
    ads: [],
    assets: [],
    runtime:{...runtime,assetVersion:assets.id,assetManifestSha256:assets.manifestSha256,fonts,serif},
  };
  write(path.join(work,"background-inventory.json"), inventory.backgrounds);
  report.assets = inventory.backgrounds;
  checkpoint(report);
  const valid = [];
  const musicTracks = read(path.join(root,"data/music.json")).tracks;
  const musicProbes = new Map();
  for (const ad of ads) {
    try {
      const requestedMusic = resolveMusic({adMusic: ad.music, campaignMusic: manifest.music,
        track: musicTrack, noMusic, overrides: musicOverrides});
      ad.music = normalizeMusic(requestedMusic, musicTracks);
      if (ad.music) {
        const musicPath = safeFile(runtime.assetRoot, `music/${ad.music.filename}`);
        if(!assets.entries.some(e=>e.path===`music/${ad.music.filename}`))throw Error('Selected music is not in the verified asset bundle');
        if (!musicProbes.has(musicPath)) {
          const metadata = probe(musicPath);
          const audio = metadata.streams.find((s) => s.codec_type === "audio");
          if (!audio) throw Error("Music file has no audio stream");
          musicProbes.set(musicPath, Number(audio.duration ?? metadata.format.duration));
        }
        const actualDuration = musicProbes.get(musicPath);
        if (!Number.isFinite(actualDuration) || ad.music.startTime + 10 > actualDuration + 0.00001)
          throw Error("Actual music file has insufficient remaining audio for 10 seconds");
      }
      ad.style = styleOverride ?? ad.style ?? manifest.style;
      ad.layoutMode ??= manifest.layoutMode ?? layoutPolicy.defaultMode;
      if (!["compact", "distributed"].includes(ad.layoutMode)) throw Error(`Unknown layout mode: ${ad.layoutMode}`);
      if (ad.style !== undefined && !Object.hasOwn(namedStyles, ad.style)) throw Error(`Unknown style: ${ad.style}`);
      const styleProfile = ad.style ? namedStyles[ad.style] : undefined;
      if (styleProfile) ad.fontPreset = styleProfile.fontPreset;
      identifier(ad.id, "ad id");
      identifier(ad.outputName, "output name");
      if (outputs.has(ad.outputName))
        throw Error(`Duplicate output name ${ad.outputName}`);
      outputs.add(ad.outputName);
      if (option("--font")) {
        if (styleProfile && option("--font") !== styleProfile.fontPreset) throw Error(`${styleProfile.name} uses the saved ${styleProfile.fontPreset} font preset`);
        ad.fontPreset = option("--font");
      }
      if (!presets[ad.fontPreset]) throw Error("Unknown font preset");
      if (option("--background"))
        ad.background.filename = option("--background");
      const bg = inventory.backgrounds.find((b) => b.filename === ad.background?.filename);
      if (!bg) throw Error("Unknown background filename");
      number(ad.background.startTime, 0, bg.duration, "start time");
      if (ad.background.startTime + 10 > bg.duration + 0.00001)
        throw Error(
          `${bg.filename} has insufficient remaining footage: ${bg.duration}s. Choose a ≥10s clip; short clip extensions are not enabled.`,
        );
      if (
        !Array.isArray(ad.background.cropPosition) ||
        ad.background.cropPosition.length !== 2
      )
        throw Error("Crop must be [horizontal%, vertical%]");
      ad.background.cropPosition.forEach((v) => number(v, 0, 100, "crop"));
      ad.contrast ??= styleProfile ? styleProfile.defaultContrast : manifest.defaultContrast;
      number(ad.contrast, 0, 0.5, "contrast");
      if (!ad.blocks.length) throw Error("Ad has no text blocks");
      for (const b of ad.blocks) {
        if (b.styleRole !== undefined && !Object.hasOwn((styleProfile ?? style1).roles, b.styleRole)) throw Error(`Unknown style role: ${b.styleRole}`);
        for (const [key, min, max] of [
          ["x", 0, 1080],
          ["y", 0, 1920],
          ["fontSize", 44, 100],
          ["maxWidth", 150, styleProfile?.maxWidth ?? 900],
          ["paddingX", 0, 40],
          ["paddingY", 0, 30],
          ["radius", 0, 30],
          ["lineHeight", 1, 1.6],
        ])
          if (b[key] !== undefined) number(b[key], min, max, `${b.id}.${key}`);
        if (
          b.fontFamily !== undefined &&
          !["Roboto", "Roboto Condensed", "Times New Roman"].includes(b.fontFamily)
        )
          throw Error("Unsupported font family");
        if (b.fontWeight !== undefined && ![400, 500, 700].includes(b.fontWeight))
          throw Error("Unsupported font weight");
        if (
          b.highlight !== undefined &&
          !["black", "white", "plain"].includes(b.highlight)
        )
          throw Error("Unsupported highlight style");
        if (
          b.lines !== undefined &&
          (!Array.isArray(b.lines) ||
            b.lines.some((s) => typeof s !== "string" || !s.trim()))
        )
          throw Error("Invalid explicit lines");
      }
      valid.push(ad);
    } catch (e) {
      report.ads.push({ id: ad.id, status: "failed", reason: e.message });
    }
  }
  // Use grapheme clusters so modifiers, ZWJ sequences, flags and keycaps stay intact.
  const emojiMap = read(path.join(publicDir,"emoji/map.json")),
    jobs = [];
  for (const ad of valid)
    for (const b of ad.blocks)
      for (const { segment } of new Intl.Segmenter("en", {
        granularity: "grapheme",
      }).segment(b.text)) {
        if (
          /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(
            segment,
          )
        ) {
          const file = `emoji/${Buffer.from(segment).toString("hex")}.png`;
          emojiMap[segment] = file;
          jobs.push({ text: segment, path: safeFile(publicDir,file) });
        }
      }
  write(path.join(publicDir,"emoji/map.json"), emojiMap);
  write(path.join(work, "emoji-jobs.json"), jobs);
  if (jobs.some((j) => !fs.existsSync(j.path)))
    run("swift", ['-module-cache-path',path.join(work,'swift-module-cache'),path.join(root,"scripts/emoji.swift"), path.join(work, "emoji-jobs.json")]);
  const serveUrl = await bundle({
    entryPoint: path.join(root, "src/index.ts"),
    rootDir:root,
    publicDir,
    outDir:path.join(work,'bundle'),
    enableCaching:false,
    webpackOverride:config=>({...config,cache:false}),
  });
  const rendered = [];
  for (const ad of valid) {
    checkpoint(report);
    try {
      const props = { ad, safeMargins: ad.style && ad.style !== "style-1" ? namedStyles[ad.style].canvas.safeMargins : manifest.safeMargins,
        runtime:{emojiMap,backgrounds:inventory.backgrounds,serifFont:serif?'fonts/TimesNewRoman-Installed.ttf':null} };
      write(path.join(work, `${ad.id}-resolved.json`), props);
      const composition = await selectComposition({
        serveUrl,
        id: "InstagramNativeAd",
        inputProps: props,
        browserExecutable:runtime.browserExecutable,
      });
      // A rendered still triggers font loading, wrapping, safe-area and overlap checks
      // before any final file is written. Failures are reported without dropping text.
      const stills = [];
      for (const frame of [0, 150, 299]) {
        const output = path.join(work, `${ad.id}-${frame}.png`);
        await renderStill({
          serveUrl,
          composition,
          inputProps: props,
          frame,
          output,
          imageFormat: "png",
          browserExecutable:runtime.browserExecutable,
        });
        stills.push(output);
      }
      if (validateOnly) {
        report.ads.push({ id: ad.id, status: "validated", stills });
        continue;
      }
      const outputDir = runtime.outputRoot;
      fs.mkdirSync(outputDir, { recursive: true });
      const output = path.join(outputDir, `IG-${ad.outputName}-${stamp}.mp4`);
      if (fs.existsSync(output)) throw Error("Output already exists");
      const staging = path.join(work, `${ad.id}-verified-render.mp4`);
      console.log(`Rendering ${ad.id} → ${output}`);
      await renderMedia({
        serveUrl,
        composition,
        inputProps: props,
        outputLocation: staging,
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 18,
        imageFormat: "png",
        muted: !ad.music,
        ...(ad.music ? {audioCodec: "aac", audioBitrate: "192k"} : {}),
        concurrency: runtime.concurrency,
        browserExecutable:runtime.browserExecutable,
      });
      let audioTimingNormalization = "not needed";
      if (ad.music) {
        // The pinned renderer can mux a padded AAC packet beyond frame 299.
        // Trim decoded audio exactly to the composition; copy H.264 unchanged.
        const rawMetadata = probe(staging);
        if (Math.abs(Number(rawMetadata.format.duration) - 10) > 0.0001) {
          const exact = path.join(work, `${ad.id}-exact-duration.mp4`);
          run("ffmpeg", ["-v", "error", "-xerror", "-i", staging,
            "-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy",
            "-af", "atrim=duration=10,asetpts=PTS-STARTPTS", "-c:a", "aac", "-b:a", "192k",
            "-t", "10", "-movflags", "+faststart", exact]);
          fs.renameSync(exact, staging);
          audioTimingNormalization = "AAC padding trimmed to exactly 10s; video stream copied unchanged";
        }
      }
      const metadata = probe(staging),
        v = metadata.streams.find((s) => s.codec_type === "video");
      const audioStreams = metadata.streams.filter((s) => s.codec_type === "audio");
      const audioValid = ad.music
        ? audioStreams.length === 1 && audioStreams[0].codec_name === "aac" &&
          Math.abs(Number(audioStreams[0].duration) - 10) <= 0.0001
        : audioStreams.length === 0;
      if (
        v.codec_name !== "h264" ||
        v.pix_fmt !== "yuv420p" ||
        v.width !== 1080 ||
        v.height !== 1920 ||
        v.r_frame_rate !== "30/1" ||
        Number(v.nb_frames) !== 300 ||
        Math.abs(Number(metadata.format.duration) - 10) > 0.0001 ||
        !audioValid
      )
        throw Error(
          "Rendered metadata does not meet the 300-frame H.264 / selected audio specification",
        );
      run("ffmpeg", [
        "-v",
        "error",
        "-xerror",
        "-i",
        staging,
        "-f",
        "null",
        "-",
      ]);
      write(path.join(work, `${ad.id}-metadata.json`), metadata);
      if (fs.existsSync(output))
        throw Error("Output appeared during rendering; refusing to overwrite");
      // Journal the verified candidate before publishing its canonical copy. Recovery
      // reconciles this record if the process exits between copy and final checkpoint.
      report.pendingDelivery={id:ad.id,status:'rendered',output,stills,music:ad.music??null,sha256:sha256(fs.readFileSync(staging)),audioTimingNormalization,
        metadata:{codec:v.codec_name,pixelFormat:v.pix_fmt,width:v.width,height:v.height,fps:v.r_frame_rate,frames:v.nb_frames,duration:metadata.format.duration,decode:'passed',audio:ad.music?'aac':'none'}};
      checkpoint(report);
      fs.copyFileSync(staging,output,fs.constants.COPYFILE_EXCL);
      const outputSha256=sha256(fs.readFileSync(output));
      if(outputSha256!==sha256(fs.readFileSync(staging)))throw Error('Output copy checksum mismatch');
      report.ads.push({
        id: ad.id,
        status: "rendered",
        output,
        stills,
        music: ad.music ?? null,
        audioTimingNormalization,
        sha256:outputSha256,
        metadata: {
          codec: v.codec_name,
          pixelFormat: v.pix_fmt,
          width: v.width,
          height: v.height,
          fps: v.r_frame_rate,
          frames: v.nb_frames,
          duration: metadata.format.duration,
          decode: "passed",
          audio: ad.music ? "aac" : "none",
        },
      });
      rendered.push({ id: ad.id, stills });
      delete report.pendingDelivery;
      checkpoint(report);
    } catch (e) {
      console.error(`${ad.id}: ${e.message}`);
      report.ads.push({ id: ad.id, status: "failed", reason: e.message });
      checkpoint(report);
    }
  }
  if (rendered.length) {
    const tiles = rendered.flatMap((a) => a.stills);
    const argv = ["-v", "error", "-y"];
    tiles.forEach((f) => argv.push("-i", f));
    const chains = tiles.map((_, i) => `[${i}:v]scale=270:480[v${i}]`);
    chains.push(
      tiles.map((_, i) => `[v${i}]`).join("") +
        `xstack=inputs=${tiles.length}:layout=` +
        tiles
          .map((_, i) => `${(i % 3) * 270}_${Math.floor(i / 3) * 480}`)
          .join("|") +
        "[sheet]",
    );
    const output = path.join(
      work,
      isDemo
        ? "template-qa-contact-sheet.png"
        : `campaign-contact-sheet-${stamp}.png`,
    );
    run("ffmpeg", [
      ...argv,
      "-filter_complex",
      chains.join(";"),
      "-map",
      "[sheet]",
      "-frames:v",
      "1",
      output,
    ]);
    report.contactSheet = output;
  }
  checkpoint(report);
  write(path.join(runtime.workRoot,"latest-report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (report.ads.some((a) => a.status === "failed")) process.exitCode = 1;
}
