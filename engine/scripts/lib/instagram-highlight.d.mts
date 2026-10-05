export type HighlightPreset = "hook" | "label" | "white" | "black";
export type Geometry = {
  paddingXEm: number; paddingYEm: number; rowHeightEm: number;
  outerRadiusEm: number; innerRadiusEm: number;
};
export type HighlightOptions = {
  textWidths: number[]; rowHeight: number; paddingX: number; paddingY: number;
  outerRadius: number; innerRadius?: number; mergeThreshold?: number;
};
export function buildHighlight(options: HighlightOptions): HighlightOptions & {
  width: number; height: number; widths: number[]; d: string;
};
export const calibratedPresets: Record<HighlightPreset, Geometry>;
export function optionsForBlock(block: {
  fontSize: number; preset?: HighlightPreset; fill?: string; geometry?: Partial<Geometry>;
}, textWidths: number[]): HighlightOptions;
