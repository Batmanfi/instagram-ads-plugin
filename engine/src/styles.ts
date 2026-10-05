import style1 from "../data/styles/style-1/definition.json";
import style2 from "../data/styles/style-2/definition.json";
import style3 from "../data/styles/style-3/definition.json";
import style4 from "../data/styles/style-4/definition.json";
import type {Ad, Block, FontPreset} from "./types";
import type {Geometry, HighlightPreset} from "../scripts/lib/instagram-highlight.mjs";

type RoleSettings = {
  fontSize: number;
  highlight: NonNullable<Block["highlight"]>;
  preset: HighlightPreset;
  fontFamily?: FontPreset["family"];
  fontWeight?: FontPreset["weight"];
  letterSpacingEm?: number;
  geometry?: Geometry;
  textColor?: string;
  highlightColor?: string | null;
};
type NamedStyle = {
  name: string;
  canvas: {safeMargins: {top: number; side: number; bottom: number}};
  fontFamily: FontPreset["family"];
  fontWeight: FontPreset["weight"];
  letterSpacingEm: number;
  maxWidth: number;
  defaultContrast: number;
  mergeThresholdEm: number;
  highlightPresets: Record<HighlightPreset, Geometry>;
  roles: Record<NonNullable<Block["styleRole"]>, RoleSettings>;
};
export const namedStyles = {"style-1": style1, "style-2": style2, "style-3": style3, "style-4": style4} as Record<NonNullable<Ad["style"]>, NamedStyle>;
