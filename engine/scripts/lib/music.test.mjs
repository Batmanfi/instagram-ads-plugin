import test from "node:test";
import assert from "node:assert/strict";
import {resolveMusic, normalizeMusic, musicVolumeAtFrame} from "./music.mjs";

const tracks = [{id: "chill-sunday", filename: "chill-sunday.mp3", duration: 111}];
const settings = {track: "chill-sunday", startTime: 18, volume: 0.25};
test("Library availability does not opt in; ad/CLI can disable saved campaign music", () => {
  assert.equal(normalizeMusic(resolveMusic(), tracks), undefined);
  assert.equal(resolveMusic({adMusic: false, campaignMusic: settings}), undefined);
  assert.equal(resolveMusic({adMusic: null, campaignMusic: settings}), undefined);
  assert.equal(resolveMusic({adMusic: settings, noMusic: true}), undefined);
  assert.throws(() => resolveMusic({noMusic: true, track: "chill-sunday"}), /cannot be combined/);
  assert.throws(() => resolveMusic({overrides: {volume: 0.5}}), /selected track/);
});
test("Explicit campaign, ad and run selections have deterministic precedence", () => {
  assert.deepEqual(resolveMusic({campaignMusic: settings}), settings);
  const resolved = normalizeMusic(resolveMusic({campaignMusic: settings,
    adMusic: {...settings, startTime: 22}, overrides: {volume: 0.4}}), tracks);
  assert.equal(resolved.startTime, 22);
  assert.equal(resolved.volume, 0.4);
  assert.equal(normalizeMusic(resolveMusic({adMusic: false, track: "chill-sunday",
    overrides: {startTime: 0, volume: 0.25}}), tracks).track, "chill-sunday");
});
test("Reject missing gain/cue, invalid tracks, stale filename, path traversal and short remaining audio", () => {
  for (const invalid of [{track: "chill-sunday"}, {...settings, volume: 0},
    {...settings, volume: NaN}, {...settings, volume: 1.1}, {...settings, startTime: -1},
    {...settings, startTime: 101.02}, {...settings, track: "missing"},
    {...settings, filename: "other.mp3"}, {...settings, loop: true}])
    assert.throws(() => normalizeMusic(invalid, tracks));
  assert.throws(() => normalizeMusic(settings, [{...tracks[0], filename: "../track.mp3"}]));
  assert.throws(() => normalizeMusic(settings, [{...tracks[0], duration: NaN}]));
  assert.equal(normalizeMusic({...settings, startTime: 101}, tracks).startTime, 101);
});
test("Frame-aligned cues and fades stay within duration and gain for all 300 frames", () => {
  const m = normalizeMusic({...settings, startTime: 18.02, fadeInSeconds: 0.25, fadeOutSeconds: 0.5}, tracks);
  assert.equal(m.startTime, 541 / 30);
  assert.equal(musicVolumeAtFrame(m, 0), 0);
  assert.equal(musicVolumeAtFrame(m, 150), 0.25);
  assert.equal(musicVolumeAtFrame(m, 299), 0);
  for (let f = 0; f < 300; f++) assert.ok(musicVolumeAtFrame(m, f) >= 0 && musicVolumeAtFrame(m, f) <= 0.25);
  assert.throws(() => normalizeMusic({...settings, fadeInSeconds: 5, fadeOutSeconds: 5}, tracks), /overlap/);
  const noFades = normalizeMusic(settings, tracks);
  assert.equal(musicVolumeAtFrame(noFades, 0), 0.25);
  assert.equal(musicVolumeAtFrame(noFades, 299), 0.25);
});
