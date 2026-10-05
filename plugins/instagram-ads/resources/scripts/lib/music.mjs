// No library-wide soundtrack or loudness default: a request must select music
// and provide its start time and gain in the current campaign or CLI run.
export const resolveMusic = ({adMusic, campaignMusic, track, noMusic = false, overrides = {}} = {}) => {
  if (noMusic && (track !== undefined || Object.keys(overrides).length))
    throw Error("--no-music cannot be combined with music options");
  if (noMusic) return undefined;
  const selected = adMusic !== undefined ? adMusic : campaignMusic;
  if ((selected === undefined || selected === null || selected === false) && track === undefined) {
    if (Object.keys(overrides).length) throw Error("Music adjustments require a selected track");
    return undefined;
  }
  if (selected !== undefined && selected !== null && selected !== false &&
      (typeof selected !== "object" || Array.isArray(selected)))
    throw Error("music must be an explicit settings object, null or false");
  return {...(selected || {}), ...(track !== undefined ? {track} : {}), ...overrides};
};

export const normalizeMusic = (settings, tracks, fps = 30, durationInFrames = 300) => {
  if (settings === undefined || settings === null || settings === false) return undefined;
  if (typeof settings !== "object" || Array.isArray(settings)) throw Error("Invalid music settings");
  const allowed = ["track", "filename", "startTime", "volume", "fadeInSeconds", "fadeOutSeconds"];
  for (const key of Object.keys(settings)) if (!allowed.includes(key)) throw Error(`Unknown music setting: ${key}`);
  const track = tracks.find((t) => t.id === settings.track || t.filename === settings.track ||
    (settings.track === undefined && t.filename === settings.filename));
  if (!track) throw Error(`Unknown music track: ${settings.track ?? settings.filename}`);
  if (settings.filename !== undefined && settings.filename !== track.filename) throw Error("Music track/filename mismatch");
  if (typeof track.filename !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(mp3|wav|m4a)$/i.test(track.filename))
    throw Error("Invalid local music filename");
  const check = (value, min, max, label) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
      throw Error(`Invalid music ${label}: ${value}`);
    return value;
  };
  const duration = durationInFrames / fps;
  const sourceDuration = check(track.duration, duration, Infinity, "source duration");
  const requestedStart = check(settings.startTime, 0, sourceDuration, "startTime (required)");
  const startTime = Math.round(requestedStart * fps) / fps;
  if (startTime + duration > sourceDuration + 0.00001)
    throw Error(`${track.filename} has insufficient music for ${duration}s from ${startTime}s`);
  const volume = check(settings.volume, 0.001, 1, "volume (required, >0 through 1)");
  const fadeInSeconds = check(settings.fadeInSeconds ?? 0, 0, duration, "fadeInSeconds");
  const fadeOutSeconds = check(settings.fadeOutSeconds ?? 0, 0, duration, "fadeOutSeconds");
  const inFrames = Math.round(fadeInSeconds * fps), outFrames = Math.round(fadeOutSeconds * fps);
  if (inFrames + outFrames > durationInFrames - 1) throw Error("Music fades overlap; leave an audible full-volume interval");
  return {track: track.id, filename: track.filename, startTime, volume,
    fadeInSeconds: inFrames / fps, fadeOutSeconds: outFrames / fps};
};

// Composition time makes this envelope independent of the source trim offset.
export const musicVolumeAtFrame = (music, frame, fps = 30, durationInFrames = 300) => {
  const fadeIn = Math.round(music.fadeInSeconds * fps);
  const fadeOut = Math.round(music.fadeOutSeconds * fps);
  const gainIn = fadeIn ? Math.min(1, Math.max(0, frame / fadeIn)) : 1;
  const gainOut = fadeOut ? Math.min(1, Math.max(0, (durationInFrames - 1 - frame) / fadeOut)) : 1;
  return music.volume * Math.min(gainIn, gainOut);
};
