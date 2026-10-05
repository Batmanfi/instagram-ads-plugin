import type { MusicSettings } from "../scripts/lib/music.mjs";
export type FontPreset = {
  family: "Roboto" | "Roboto Condensed" | "Times New Roman";
  weight: 400 | 500 | 700;
};
export type Block = {
  id: string;
  text: string;
  lines?: string[];
  x?: number;
  y?: number;
  fontSize?: number;
  fontFamily?: FontPreset["family"];
  fontWeight?: FontPreset["weight"];
  highlight?: "black" | "white" | "plain";
  maxWidth?: number;
  lineHeight?: number;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  styleRole?: "hook" | "label" | "support" | "proof" | "cta";
};
export type Ad = {
  music?: MusicSettings | null | false;
  style?: "style-1" | "style-2" | "style-3" | "style-4";
  layoutMode?: "compact" | "distributed";
  id: string;
  outputName: string;
  fontPreset: string;
  background: {
    filename: string;
    startTime: number;
    cropPosition: [number, number];
  };
  contrast?: number;
  blocks: Block[];
};
export type Props = {
  ad: Ad;
  safeMargins: { top: number; bottom: number; side: number };
  runtime?: {
    emojiMap?: Record<string,string>;
    backgrounds?: {filename:string;width:number;height:number}[];
    serifFont?: string | null;
  };
};
