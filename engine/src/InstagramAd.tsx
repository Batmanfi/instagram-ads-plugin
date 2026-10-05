import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  delayRender,
  continueRender,
  cancelRender,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import presets from "../data/font-presets.json";
import emojiMap from "../public/emoji/map.json";
import backgrounds from "../data/backgrounds.json";
import manifest from "../data/manifest.json";
import { fontsReady } from "./fonts";
import { highlightPath } from "./highlight";
import { namedStyles } from "./styles";
import { stackBlocks } from "../scripts/lib/block-layout.mjs";
import musicLibrary from "../data/music.json";
import { normalizeMusic, musicVolumeAtFrame } from "../scripts/lib/music.mjs";
import { buildHighlight, optionsForBlock, type HighlightPreset } from "../scripts/lib/instagram-highlight.mjs";
import type { Props, Block, FontPreset } from "./types";
const segments = (text: string) =>
  Array.from(
    new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text),
    (v) => v.segment,
  );
const emojis = emojiMap as Record<string, string>;
const hasEmoji = (s: string) =>
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(s);
const tokens = (line: string, emojiAssets=emojis) =>
  segments(line).reduce<{ text: string; emoji?: string }[]>((a, s) => {
    if (hasEmoji(s)) {
      if (!emojiAssets[s])
        throw Error(`Emoji asset missing for ${s}. Run the production script.`);
      a.push({ text: s, emoji: emojiAssets[s] });
    } else if (a.length && !a[a.length - 1].emoji) {
      a[a.length - 1].text += s;
    } else {
      a.push({ text: s });
    }
    return a;
  }, []);
function layout(
  block: Block,
  preset: FontPreset,
  index: number,
  count: number,
  style?: Props["ad"]["style"],
  emojiAssets=emojis,
) {
  if (style !== undefined && !Object.hasOwn(namedStyles, style)) throw Error(`Unknown style ${style}`);
  const modern = style !== undefined;
  const profile = namedStyles[style ?? "style-1"];
  const role = block.styleRole ?? (index === 0 ? "hook" : index === count - 1 ? "cta" : block.id === "intro" ? "label" : block.id === "proof" ? "proof" : "support");
  const defaults = profile.roles[role];
  if (!defaults) throw Error(`Unknown style role ${role}`);
  const highlight = block.highlight ?? (modern ? defaults.highlight : "black");
  const highlightPreset = (role === "hook" ? "hook" : role === "label" ? "label" : highlight === "white" ? "white" : "black") as HighlightPreset;
  const fontSize = block.fontSize ?? (modern ? defaults.fontSize : index === 0 ? 62 : 52),
    fontFamily = modern ? defaults.fontFamily ?? profile.fontFamily : block.fontFamily ?? preset.family,
    fontWeight = modern ? defaults.fontWeight ?? profile.fontWeight : block.fontWeight ?? preset.weight;
  const letterSpacingEm = defaults.letterSpacingEm ?? profile.letterSpacingEm;
  if (fontSize < 44)
    throw Error(
      `${block.id}: font size below the 44px readability floor; request shorter copy.`,
    );
  const geometryOptions = optionsForBlock({fontSize, preset: highlightPreset, geometry: {...profile.highlightPresets[highlightPreset], ...defaults.geometry}}, [1]);
  geometryOptions.mergeThreshold = fontSize * profile.mergeThresholdEm;
  if (modern && highlight === "plain") geometryOptions.paddingX = geometryOptions.paddingY = 0;
  const maxWidth = block.maxWidth ?? (modern ? profile.maxWidth : 850),
    paddingX = modern ? geometryOptions.paddingX : block.paddingX ?? 20,
    paddingY = modern ? geometryOptions.paddingY : block.paddingY ?? 9,
    rowHeight = modern ? geometryOptions.rowHeight : fontSize * (block.lineHeight ?? 1.18);
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
  if (!document.fonts.check(context.font))
    throw Error(`Font failed to load: ${context.font}`);
  const measure = (s: string) => {
    if (modern) {
      // Match the live editor's flex rows, including tracking on text spans and
      // fixed-size emoji assets. Canvas letter spacing differs across engines.
      const row = document.createElement("div");
      Object.assign(row.style, {position: "absolute", visibility: "hidden", display: "flex", width: "max-content", whiteSpace: "pre", fontFamily, fontWeight: String(fontWeight), fontSize: `${fontSize}px`, letterSpacing: `${letterSpacingEm}em`});
      for (const token of tokens(s,emojiAssets)) {
        const node = document.createElement("span");
        if (token.emoji) Object.assign(node.style, {width: `${fontSize}px`, height: `${fontSize}px`, flexShrink: "0"});
        else node.textContent = token.text;
        row.append(node);
      }
      document.body.append(row);
      const width = row.getBoundingClientRect().width;
      row.remove();
      return width;
    }
    return tokens(s,emojiAssets).reduce(
      (w, t) => w + (t.emoji ? fontSize : context.measureText(t.text).width),
      0,
    );
  };
  let lines = block.lines;
  if (
    lines &&
    lines.join(" ").replace(/\s+/gu, " ").trim() !==
      block.text.replace(/\s+/gu, " ").trim()
  )
    throw Error(`${block.id}: explicit lines alter source copy.`);
  if (!lines) {
    lines = [];
    for (const paragraph of block.text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/(?<=\s)/u)) {
        const candidate = line + word;
        if (line && measure(candidate) > maxWidth - 2 * paddingX) {
          lines.push(line.trimEnd());
          line = word;
        } else line = candidate;
      }
      lines.push(line.trimEnd());
    }
  }
  const textWidths = lines.map(measure);
  const contour = modern ? buildHighlight({...geometryOptions, textWidths}) : undefined;
  const widths = contour?.widths ?? textWidths.map((w) => Math.ceil(w) + 2 * paddingX);
  if (widths.some((w) => w > maxWidth))
    throw Error(
      `${block.id}: copy cannot fit within ${maxWidth}px at ${fontSize}px. Adjust manual line breaks or request shorter copy.`,
    );
  const height = contour?.height ?? lines.length * rowHeight + 2 * paddingY;
  return {
    ...block,
    x: block.x ?? 540,
    y: block.y ?? 155 + index * ((1510 - 155) / Math.max(1, count - 1)),
    highlight,
    modern,
    letterSpacing: modern ? `${letterSpacingEm}em` : undefined,
    textColor: modern ? defaults.textColor ?? (highlight === "white" ? "black" : "white") : highlight === "white" ? "black" : "white",
    highlightColor: modern ? defaults.highlightColor ?? (highlight === "white" ? "#fff" : "#000") : highlight === "white" ? "#fff" : "#000",
    contourPath: contour?.d,
    radius: block.radius ?? 16,
    fontSize,
    fontFamily,
    fontWeight,
    paddingX,
    paddingY,
    rowHeight,
    lines,
    widths,
    height,
  };
}
type Layout = ReturnType<typeof layout>;
const TextBlock = ({ b, emojiAssets }: { b: Layout; emojiAssets:Record<string,string> }) => {
  const width = Math.max(...b.widths);
  return (
    <div
      style={{
        position: "absolute",
        left: b.x - width / 2,
        top: b.y,
        width,
        height: b.height,
        fontFamily: b.fontFamily,
        fontWeight: b.fontWeight,
        fontSize: b.fontSize,
        lineHeight: 1,
        letterSpacing: b.letterSpacing,
        color: b.textColor,
      }}
    >
      {b.highlight !== "plain" && (
        <svg
          width={width}
          height={b.height}
          style={{ position: "absolute", inset: 0 }}
          viewBox={`${b.modern ? 0 : -width / 2} 0 ${width} ${b.height}`}
        >
          <path
            d={b.contourPath ?? highlightPath(b.widths, b.rowHeight, b.paddingY, b.radius)}
            fill={b.highlightColor}
          />
        </svg>
      )}
      <div style={{ position: "relative", paddingTop: b.paddingY }}>
        {b.lines.map((line, i) => (
          <div
            key={i}
            style={{
              height: b.rowHeight,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              whiteSpace: "pre",
            }}
          >
            {tokens(line,emojiAssets).map((t, j) =>
              t.emoji ? (
                <Img
                  key={j}
                  src={staticFile(t.emoji)}
                  style={{
                    width: b.fontSize,
                    height: b.fontSize,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span key={j}>{t.text}</span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
export const InstagramAd: React.FC<Props> = ({ ad, safeMargins, runtime }) => {
  const [handle] = useState(() =>
    delayRender("Load local TTFs and validate copy fit"),
  );
  const [blocks, setBlocks] = useState<Layout[]>([]);
  useEffect(() => {
    let active = true;
    const margins = ad.style && ad.style !== "style-1" ? namedStyles[ad.style].canvas.safeMargins : safeMargins;
    fontsReady(ad.style === "style-4" || ad.blocks.some(b=>b.fontFamily==='Times New Roman'),runtime?.serifFont)
      .then(() => {
        const preset = (presets as Record<string, FontPreset>)[ad.fontPreset];
        if (!preset) throw Error(`Unknown font preset ${ad.fontPreset}`);
        const b = ad.blocks.map((v, i) =>
          layout(v, preset, i, ad.blocks.length, ad.style,runtime?.emojiMap??emojis),
        );
        const positioned = ad.blocks.filter(v => v.y !== undefined).length;
        if (positioned && positioned !== ad.blocks.length) throw Error(`${ad.id}: provide y for every block or omit all y values for automatic layout.`);
        if (!positioned) {
          const positions = stackBlocks(b.map(v => v.height), margins, ad.layoutMode);
          b.forEach((v, i) => {v.y = positions.tops[i];});
        }
        for (const v of b) {
          const width = Math.max(...v.widths);
          if (
            v.x - width / 2 < margins.side ||
            v.x + width / 2 > 1080 - margins.side ||
            v.y < margins.top ||
            v.y + v.height > 1920 - margins.bottom + 0.000001
          )
            throw Error(
              `${ad.id}/${v.id}: copy exceeds safe area. Request shorter copy or adjust layout.`,
            );
        }
        for (let i = 0; i < b.length; i++)
          for (let j = i + 1; j < b.length; j++) {
            if (
              b[i].y < b[j].y + b[j].height + 28 - 0.000001 &&
              b[j].y < b[i].y + b[i].height + 28 - 0.000001
            )
              throw Error(
                `${ad.id}: blocks ${b[i].id} and ${b[j].id} overlap or lack a 28px gap.`,
              );
          }
        if (active) {
          setBlocks(b);
          continueRender(handle);
        }
      })
      .catch(cancelRender);
    return () => {
      active = false;
    };
  }, [ad, safeMargins, handle, runtime]);
  const {fps, durationInFrames} = useVideoConfig();
  const music = normalizeMusic(ad.music, musicLibrary.tracks, fps, durationInFrames);
  const source = (runtime?.backgrounds??backgrounds).find((b) => b.filename === ad.background.filename);
  if (!source) throw Error("Missing background metadata");
  const scale = Math.max(1080 / source.width, 1920 / source.height);
  const videoWidth = source.width * scale,
    videoHeight = source.height * scale;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {music && (
        <Audio
          src={staticFile(`music/${music.filename}`)}
          trimBefore={Math.round(music.startTime * fps)}
          trimAfter={Math.round(music.startTime * fps) + durationInFrames}
          volume={(frame) => musicVolumeAtFrame(music, frame, fps, durationInFrames)}
          onError={() => "fail"}
        />
      )}
      <Video
        src={staticFile(`backgrounds/${ad.background.filename}`)}
        muted
        trimBefore={Math.round(ad.background.startTime * 30)}
        objectFit="fill"
        style={{
          position: "absolute",
          width: videoWidth,
          height: videoHeight,
          left: ((1080 - videoWidth) * ad.background.cropPosition[0]) / 100,
          top: ((1920 - videoHeight) * ad.background.cropPosition[1]) / 100,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0,0,0,${ad.contrast ?? (ad.style ? namedStyles[ad.style].defaultContrast : manifest.defaultContrast)})`,
        }}
      />
      {blocks.map((b) => (
        <TextBlock key={b.id} b={b} emojiAssets={runtime?.emojiMap??emojis} />
      ))}
    </AbsoluteFill>
  );
};
