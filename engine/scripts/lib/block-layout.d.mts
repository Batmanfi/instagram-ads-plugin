export type LayoutMode = 'compact' | 'distributed';
export function stackBlocks(heights: number[], safeMargins: {top: number; bottom: number}, mode?: LayoutMode, canvasHeight?: number): {
  mode: LayoutMode;
  tops: number[];
  gap: number;
  totalHeight: number;
  groupTop: number;
  groupBottom: number;
  groupCenter: number;
  spareAbove: number;
  spareBelow: number;
};
