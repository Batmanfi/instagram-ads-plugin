# Private releases and updates — 0.3.0-alpha.1

The local release manager is implemented. It accepts a trusted offline/private release descriptor, stages verified plugin/engine/assets, installs pinned engine dependencies explicitly, and atomically activates or rolls back the tuple used by future campaigns. It retains active jobs, pending forms, outputs and all old versions. It does not install the plugin inside Codex or publish to a remote repository. A clean teammate installation is the next acceptance milestone.

## Release contract and layout

A version-1 release descriptor has a content-derived releaseId, release notes, an explicit macOS/architecture/Node-major compatibility range, workflow/engine/job schema IDs, and separate plugin/engine/asset versions and hashes. Sibling plugin/engine ZIPs have a declared regular-file index with sizes and SHA-256s. The asset library is imported separately using a hashed sibling asset manifest. The descriptor's own SHA-256 must come from a trusted maintainer/private channel. These hashes detect corruption relative to that trusted descriptor; they are not a digital signature or publisher authentication.

The development candidate declares macOS arm64 and Node 22–26 as its compatibility policy. Actual local installer/job verification uses arm64/Node 24; other Node majors, macOS releases, Intel Macs and installed Codex versions require pilot evidence. Unknown APIs/schema versions fail, rather than pretending an arbitrary upgrade can run an old job.

```text
~/Library/Application Support/Instagram Ads/
  settings.json                         user roots/timezone
  engine-config.json                    one atomic active tuple
  components/plugin/<workflow-hash>/    verified source, never Codex cache
  components/engine/<engine-hash>/       engine + its pinned node_modules
  components/assets/<manifest-hash>/    manifest.json + read-only files/
  releases/<release-id>/                descriptor/receipt + own marketplace copy
  workflows/<workflow-hash>/            immutable form/worker/delivery snapshots
  jobs/<job-id>/                         immutable inputs/spec + writable progress
  dependency-receipts/ dependency-logs/ npm-cache/
  staging/ release-events/
~/Documents/Instagram Ads/
  Campaigns/ Workspace/ Compatibility/
  Renders/Ad-Campaigns/ Deliveries/ Index/
```

Components deduplicate by content identity. The managed engine is prepared once; repeating dependency setup checks the installed versions without rerunning npm. Reinstallation into an engine pinned by any existing job refuses. All owned paths reject symlink/traversal aliases. Extraction rejects CRC/hash/size mismatch, duplicate/unexpected paths, encrypted/nonregular files and excessive declared uncompressed sizes. Plugin/engine packages cannot ship node_modules. npm ci uses the exact lock, no lifecycle scripts and an owned local cache. No global tools/browser/fonts are installed.

## Commands and transaction behavior

Invoke the actual plugin's scripts/cli.mjs with Node. Initialize owned state/data roots with `init`; all commands accept `--state-root` for a nondefault location. See the [setup skill reference](../plugins/instagram-ads/skills/setup-instagram-ads/references/release-updates.md) and [teammate pilot guide](TEAMMATE-QUICKSTART.md). Record second-Mac results in [SECOND-MAC-ACCEPTANCE.md](SECOND-MAC-ACCEPTANCE.md).

| Command | Behavior |
|---|---|
| release-check --manifest ABS --manifest-sha256 SHA | Read-only trusted-descriptor compatibility/change/refresh report; no polling or automatic updates |
| release-stage --manifest ABS --manifest-sha256 SHA --asset-root ABS | Verify/extract/import beside prior components and create a release-local marketplace; never activate |
| release-install-dependencies --release-id SHA | Explicit local pinned npm setup; logs and receipt; never touch a running/retained job engine |
| release-activate --release-id SHA --runtime ABS | Probe all hashes, installed dependencies, media, browser/fonts and QA tools before atomic engine-config commit |
| release-status | Show selector, retained release IDs and running-command workflow mismatch |
| release-rollback --release-id OLD_SHA --runtime ABS | Same verified activation path selecting a retained old release for future campaigns |

Runtime JSON version 1 specifies absolute browserExecutable, optional exact serifFontFile and concurrency 1–16. The manager supplies the staged assetRoot/assetManifest. The existing engine preflight checks actual scenery/music streams and installed local font identity. A missing Style 4 font fails visibly when Style 4 is requested; include and check it in the pilot to make all four styles ready. Ordinary release activation never starts a render.

The only critical activation commit is one fsynced atomic JSON rename. A killed process leaves the old or new full tuple. Optional history is advisory; release-status and engine-config are authoritative even if history writing fails. Staging failures preserve the existing selector. Interrupted staging can leave unselected scratch/verified components; inspect the exited lock owner and explicitly use --recover-lock before retry. No cleanup command deletes versions or customer state.

New campaigns freeze the entire engine tuple at preparation, alongside the workflow hash. A later update/rollback cannot change their pending form or final Start engine selection. Existing jobs freeze their workflow worker/packager and engine/assets/browser/font/input hashes; resume/finalize remain pinned. QA/output checks and explicit final Start authorization are unchanged.

## What requires refresh

| Change | Local action |
|---|---|
| Plugin skill/form/worker/package changes | Stage and select release, then explicitly refresh the plugin in Codex and verify the installed skill's actual workflow hash before new campaigns |
| Engine-only changes | Stage/install/probe/activate engine; unchanged plugin workflow does not require a plugin refresh |
| Assets-only changes | Import/probe/activate verified new library; unchanged plugin workflow does not require a plugin refresh |
| Rollback with a different plugin workflow | Select old tuple and refresh Codex to its retained marketplace source; old active jobs keep their own pins |
| Skipped update | Keep using the existing selected tuple; no dependency on maintainer availability |

A source CLI hash match proves only that command's version. It does not prove Codex loaded the intended installed skill. New manager-aware preparation blocks a detected workflow mismatch. Pre-manager 0.2 plugins cannot enforce this new guard: refresh those before allowing new campaigns after activation. Never overwrite an old cache/workflow to force a fix into an active job.

## Practical private repository arrangement

Use one private repository containing the development source, root marketplace, portable plugin, retained engine source, asset inventories and release tools. Exclude .local, node_modules, customer campaigns, delivery MP4s and uncleared media. Use immutable release tags and protected review; distribute the offline release kit and its manifest digest through authenticated private releases. Each teammate owns Git access; no borrowed token or maintainer computer/service is needed. Store approved media in a separately access-controlled versioned library with rights records; retain hashes and never alter a shipped version.

Official documentation supports local/Git marketplace sources, separate cached installed plugin copies, and an explicit marketplace upgrade command. It also documents updating the marketplace source and restarting the desktop app for local changes. Our manager exposes a local catalog and mismatch check; actual installed refresh behavior must be verified in the supported client during the pilot. [OpenAI plugin packaging and distribution documentation](https://developers.openai.com/plugins/build/plugins) (checked 2026-10-05).

Suggested teammate registration, only when separately authorized, is `codex plugin marketplace add OWNER/PRIVATE_REPO --ref RELEASE_TAG`, then installation through the client. Refresh the intended private source explicitly through `codex plugin marketplace upgrade MARKETPLACE_NAME`, follow the client's plugin refresh/restart flow, and run diagnostics from the installed skill. These commands are instructions, not commands executed here. Do not assume advancing a branch silently updates every teammate's cached plugin or engine.

Current media is marked local-only because redistribution clearance is not established. The candidate kit ships metadata, code/engine and local Roboto/emoji license records, but no scenery/music or system Times New Roman. `--local-only-assets` exists for isolated local QA; it is not a team clearance bypass. The kit therefore is not yet a complete ready-to-distribute production installation.

## Recovery migration policy

No automatic job migration or automatic version cleanup exists. Compatible updates affect new campaigns and leave old jobs on their verified worker. If an old worker has a recovery bug, an explicit future migration must preserve old/new spec lineage; require no live worker/renderer; verify exact archived source, choices, schemas and all reused output hashes/full decodes; rebind QA to actual artifacts; preserve failures and prevent duplicate delivery. Unsupported schema changes must refuse. This candidate intentionally has no general migration command and never silently edits pinned code. A deliberate new campaign is a separate production action, with any recovered/duplicate output handling recorded explicitly.

## Validation and remaining gates

Local unit/integration scenarios cover trusted hashes, unsafe ZIPs, idempotence, incomplete setup, selector preservation, workflow mismatch and pending-form pinning. The synthetic installer harness stages a fresh managed engine, installs its pinned packages, exercises separate plugin/engine/asset releases, updates and rolls back during an actual local render, verifies old pins and completes QA/delivery. Results are recorded under .local/evidence, not evidence of Codex installation.

Before release to a teammate: establish asset distribution rights, create/grant the actual private repository/release access, and run the second-Mac/account pilot for installation/discovery, native final follow-up, full synthetic campaign, own Drive authentication/full tabs, real playback/audio, interruption/reboot recovery, refresh/rollback/skipped versions, output preservation and maintainer-Mac-offline operation. No remote repository or teammate access was invented here.

Legacy pending forms created before preparation-time engine pins cannot infer their original engine after a managed update. Start refuses them under a managed selector. Restore their known original unmanaged configuration or explicitly prepare a new campaign; existing committed jobs still resume their immutable specs.

## Completed local acceptance — 2026-10-05

37 integration/unit checks passed, along with package/path/syntax/hash/style checks and both skill validators. The final candidate was staged into a fresh managed engine with its own pinned npm installation. Actual renderer and worker were alive during update/rollback. Separate plugin-only, engine-only and asset-only changes passed; skipping a staged update preserved the active selector; a changed running workflow blocked new preparation; a copied refreshed source workflow matched (not an installed Codex refresh test). Old job/form records remained unchanged, new preparation used the new asset tuple, rollback retained all four releases, and the original job completed verified QA/delivery with idempotent finalization.

- Plugin: 0.3.0-alpha.1, workflow `f2a65398de9a6fbcfb19d8fccb4147b6c02f069c05c0c066260578649dd7afcd`.
- Engine: 0.2.0-alpha.1, ID `017106443f9e264bc49de1681f5d22308019a1362d50b7bd56fa76042d00d666`; renderer code unchanged by this milestone.
- Local-only assets: source-v1. Final release ID `d1520dd4f7bd5541a922e8634fbc5615c7676f55a16b61f79985abfed0f5af49`.
- Evidence: `.local/evidence/releases-lifecycle.json`, `release-kit-smoke.json`, `integration-tests.txt`, `skill-validation.txt`, `production-final-verification.json`; package records in `.local/dist`.
- Synthetic complete delivery: `.local/release-qa/2026-10-04T19-56-14-127Z/data/Deliveries/release-lifecycle-qa-2026-10-05-01-bc436290`; 1/1 verified MP4, source ZIP 304 entries, complete ZIP 24 entries, idempotent complete ZIP SHA `30fc132fd9222c97a5e350c02a7236f9c4b4f242a81c736d325cd14bbc86b79b`.
- Direct QA inspected frames 0/150/299 and ten motion samples, exact four Style 4 blocks/fox emoji/compact layout, resolved Sunday Evening cue/gain/fades and AAC/full-decode/nonzero unclipped technical audio. Subjective real-time listening remains a pilot check.
- Original production inventory: 15,601 entries and 327 content hashes unchanged; no production command executed.

The verified candidate kit excludes media/system fonts and includes a bootstrap CLI plus pilot guide/acceptance template. It remains a local candidate until approved assets, private access and the installed second-Mac workflow pass.
