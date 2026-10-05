import React from "react";
import { Composition } from "remotion";
import { InstagramAd } from "./InstagramAd";
import demo from "../data/demo.json";
import manifest from "../data/manifest.json";
import copy from "../data/copy.json";
import type { Ad } from "./types";
// Studio opens the first campaign ad. Batch/single rendering supplies resolved
// props to this same composition rather than registering components per ad.
const firstLayout = manifest.ads[0];
const firstCopy = copy.ads.find((ad) => ad.id === firstLayout?.id);
const firstMusic = (firstLayout as {music?: Ad["music"]} | undefined)?.music;
const previewAd =
  firstLayout && firstCopy
    ? {
        ...firstLayout,
        music: firstMusic !== undefined ? firstMusic : (manifest as {music?: Ad["music"]}).music,
        style: (firstLayout as {style?: Ad["style"]}).style ?? (manifest as {style?: Ad["style"]}).style,
        layoutMode: (firstLayout as {layoutMode?: Ad["layoutMode"]}).layoutMode ?? (manifest as {layoutMode?: Ad["layoutMode"]}).layoutMode,
        blocks: firstCopy.blocks.map((b, i) => ({
          ...firstLayout.blocks[i],
          text: b.text,
        })),
      }
    : demo;
export const Root = () => (
  <Composition
    id="InstagramNativeAd"
    component={InstagramAd}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={{ ad: previewAd as Ad, safeMargins: manifest.safeMargins }}
  />
);
