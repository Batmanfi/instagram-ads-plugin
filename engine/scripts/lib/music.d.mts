export type MusicSettings = {
  track: string;
  filename?: string;
  startTime: number;
  volume: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
};
export type ResolvedMusic = MusicSettings & {filename: string; fadeInSeconds: number; fadeOutSeconds: number};
export function normalizeMusic(settings: MusicSettings | null | false | undefined, tracks: {id: string; filename: string; duration: number}[], fps?: number, durationInFrames?: number): ResolvedMusic | undefined;
export function musicVolumeAtFrame(music: ResolvedMusic, frame: number, fps?: number, durationInFrames?: number): number;
