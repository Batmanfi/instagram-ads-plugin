# Instagram Ads — private Codex plugin candidate

Command-backed private plugin **0.3.0-alpha.1**, retained Remotion engine **0.2.0-alpha.1**. Each teammate prepares exact-copy campaigns in Codex, uses the existing inline campaign form, and renders locally after its final Start production action. Four saved styles, compact spacing, music opt-in/per-ad overrides, immutable jobs/recovery, actual QA, full delivery, verified local release staging and rollback are implemented.

This is an alpha/pilot candidate. Local synthetic acceptance passed; installed Codex discovery/refresh/native final follow-up, own Google Drive access and the clean second-Mac/account campaign remain pending. Original production media is not in this repository or synthetic kit. Generated pilot clips/chords use original filenames/track IDs as compatibility keys only.

## Teammate pilot

Read [handoff](docs/GITHUB-HANDOFF.md), [setup](docs/TEAMMATE-QUICKSTART.md) and [acceptance](docs/SECOND-MAC-ACCEPTANCE.md). Download the private prerelease's synthetic pilot kit and trusted manifest digest. Follow its START-HERE.md to check tools/fonts/browser and set up the engine. Plugin installation/refresh is separate; engines/assets/dependencies are not supplied automatically by installing a plugin. Teammates use their own private Git and Google Drive accounts.

State defaults to ~/Library/Application Support/Instagram Ads and data to ~/Documents/Instagram Ads, independently on each Mac. No maintainer computer is needed for local preparation/render/recovery/delivery. Existing campaigns, outputs, forms/jobs and old versions remain retained through explicit updates. No automatic migration or cleanup exists.

## Shared source and releases

```sh
npm run build
npm test
npm run check
python3 scripts/package-engine.py
python3 scripts/package-plugin.py
python3 scripts/package-release.py
python3 scripts/package-release-kit.py
python3 scripts/test-release-kit.py
```

Build artifacts/test state are under ignored .local. The engine package has local Roboto/emoji/license records and all four data/design styles, but no node_modules/scenery/music/system Times New Roman. Preserve the exact engine/React lock. Source exports include baseline reference/design files as provenance, not customer campaign instructions.

For a synthetic pilot release, run python3 scripts/create-pilot-assets.py once for a new fixture version, then python3 scripts/package-pilot-kit.py. Published fixture/release versions are immutable; use a new version for later changes. Programmatic video/audio fixtures are not an original-media visual/music acceptance test.

Release manifests record separate plugin/workflow, engine and assets hashes, compatibility/schema versions and notes. Publish private prereleases from an explicit source commit/tag; teammates check/stage/install/activate locally and refresh changed plugins through Codex. Advancing source does not silently update all Macs. [Private release contract](docs/PRIVATE-RELEASES.md) describes behavior and migration limits.

## Repository boundaries

Do not commit local campaigns, outputs, dependencies, scratch, logs, private credentials or original scenery/music. Saved style examples and local font/emoji notices belong to the retained engine. Times New Roman is an installed requirement and is never bundled. This private project adds no blanket license to third-party assets; preserve their notices and clear original-media rights before distribution.
