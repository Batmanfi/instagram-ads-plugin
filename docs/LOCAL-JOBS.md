# Persistent local jobs and complete delivery — 2026-10-05

The isolated **0.2.0-alpha.1** candidate connects the existing form and retained Remotion engine to a local worker, actual QA records and verified delivery. The original production project remains read-only. This is local synthetic acceptance evidence; private installation, another Mac/account and live Drive are not claimed verified. The subsequent 0.3 local release milestone is documented in [PRIVATE-RELEASES.md](PRIVATE-RELEASES.md).

## Final action and ownership

Configure the separate engine before preparing a production campaign. The preparation record freezes whether its form offers **Start production** or **Save campaign settings**. The new final payload includes `action: start-production`; settings-only and compatibility/demo payloads cannot start jobs, including after an upgrade. Intermediate controls still make zero follow-up calls. `start` validates the trusted caller's chat association, archived source/audit/copy/metadata/snapshot, request/hash/count/order and per-ad choices through the existing resolver. It also recomputes resolved controls so local changes cannot quietly override submitted style/music.

The CLI chat ID is a trusted caller association, not signed native attestation. Actual source completeness and visual QA remain agent responsibilities; pass flags alone do not prove those inspections. Browser tests simulate the final bridge. The earlier harmless native callback passed in this chat, but the new production callback has not been submitted through an installed plugin or another account.

A stable job identity derives from the campaign and request. Complete submitted bytes and canonical choices digest are recorded. Duplicate submissions, including equivalent JSON formatting/key order, reuse the existing job. A start lock and staged job commit prevent competing starts; recovery can link an already committed job after an interrupted pointer write. Different choices require a new campaign.

## Versioned execution and mutable state

```text
State/
  settings.json
  engine-config.json                Selector for new jobs only
  workflows/<workflow-hash>/         Form/resolver/worker/packager/instructions snapshots
  jobs/<stable-id>/
    job.json, spec.json              Frozen contract and hash
    asset-manifest.json              Frozen library manifest
    inputs/                         Source, copy, layout, settings, audit, raw submission
    progress.json                   Per-ad progress and bound QA records
    attempts/<uuid>/
      runtime.json, preflight.json
      work/<timestamp-uuid>/        Resolved props, stills, reports and scratch assets
    qa-reviews/                     Actual inspection records
    active-process.json, worker.log
Data/
  Campaigns/<brand-date-run>/        Original prepared records and job pointer
  Renders/Ad-Campaigns/              Flat unique canonical MP4s
  Deliveries/<campaign-job>/         Verified delivery plus two ZIPs
  Index/<campaign-job>.json          This teammate's local index
```

Every job pins workflow hash, engine release hash/version, asset manifest/hash/version, browser executable hash, installed serif hash and input hashes. Dependencies are installed separately in a version directory; configuration checks exact direct versions and required tools without installing anything. Engine packages exclude media, dependencies and system Times New Roman. Engines/assets are separated from writable campaigns/jobs/outputs. No maintainer path or online machine is needed at runtime.

The worker executes from its job directory and runs a read-only dry-run for each attempt. It renders the densest representative first, records actual QA, then renders remaining ads individually with the shared composition. Separate per-ad runs simplify durable recovery and retain every report; they currently repeat bundling and asset staging, trading performance/disk space for reliable progress. A later batch optimization must preserve these checkpoints and QA boundaries. Per-ad music/styles remain intact; job rendering rejects global overrides.

The canonical file is staged and technically verified before copy. The renderer journals a verified publication candidate before copying, then checkpoints the completed ad. Recovery scans actual work directories (ignoring latest-report.json), probes/full-decodes/checksums outputs and matches resolved copy/settings to frozen inputs. It recovers a publication candidate when the canonical copy exists, rejects corrupted or wrong-copy artifacts, preserves valid MP4s and renders only missing/invalid ads. No valid canonical output is overwritten/deleted.

Worker and child renderer PIDs are recorded; stale lock recovery checks process liveness. A dead worker can leave its renderer alive, so resume refuses until that child exits. PID reuse conservatively blocks recovery; there is no automatic kill of an unverified/reused process. This milestone does not promise automatic crash restart or process survival across a Mac reboot: the user/agent invokes resume after restart. Changed pinned engine/assets/browser/font inputs fail visibly until originals are restored. Updated defaults affect new jobs; immutable active jobs retain their versions. Compatible migration of a broken old worker remains a future explicit migration feature, not an implicit mutation of an active job.

## QA and delivery

QA binds the output checksum, all three still hashes and resolved props. Records require frames 0/150/299, motion inspection and explicit copy/wrap/highlight/emoji/contrast/crop/margin/spacing/audio checks. Codex performs this inspection; no second user approval is introduced. After all valid ads pass, finalize rechecks artifacts and creates an atomic uniquely named delivery. It retains numbered descriptive MP4s, labeled complete contact and inspection sheets, original source/optional raw Google response, copy/layout/setup/audit, representative/remaining reports, verification/checksums, reusable source and complete ZIPs. Finalize verifies/reuses an existing delivery on repetition. Only the local Index is updated.

The source ZIP contains the exact pinned engine/lock, all saved data/design style folders, compact module/demo, local Roboto/emoji/licenses, verified local scenery/music and pinned plugin code/workflow/portable AGENTS brief. Installed Times New Roman, node_modules and scratch are excluded. Local source packaging does not establish rights to publish media or fonts. ZIP integrity/counts and canonical/delivery checksums are verified.

Unresolved ads block complete status. `finalize --allow-partial` produces a labeled partial delivery with delivered/expected counts and failure IDs/reasons; it never says complete. A completed/partial job closes; later fixes use new campaign/job records. No customer copy was altered or rendered during this milestone.

## Commands

All commands use the installed plugin's real root and local state. Initialization is separate from plugin installation.

```sh
node <plugin>/scripts/cli.mjs configure-engine --state-root <state> --engine-root <version-directory> --runtime <runtime-json>
node <plugin>/scripts/cli.mjs start --state-root <state> --campaign <slug> --chat-id <trusted-id> --choices <final-submission-json>
node <plugin>/scripts/cli.mjs job-status --state-root <state> --campaign <slug> --chat-id <trusted-id>
node <plugin>/scripts/cli.mjs qa-review --state-root <state> --campaign <slug> --chat-id <trusted-id> --review <actual-review-json>
node <plugin>/scripts/cli.mjs resume --state-root <state> --campaign <slug> --chat-id <trusted-id>
node <plugin>/scripts/cli.mjs finalize --state-root <state> --campaign <slug> --chat-id <trusted-id>
```

Exact review schema and failure behavior are in the installed skill's [production reference](../plugins/instagram-ads/skills/prepare-instagram-ads/references/production.md). Default data locations are the teammate's own Documents/Instagram Ads and Library/Application Support/Instagram Ads. Development evidence stays under this checkout's .local folder.

## Evidence and practical limits

- `jobs-campaign-verification.json`: four complete actual synthetic style MP4s, a silent override and all three supplied music tracks, exact resolved copy, technical/full-decode checks, representative/complete-set direct still and one-second-filmstrip inspections, duplicate start before/after completion, and abrupt worker interruption. Two completed outputs were recovered without changed hashes/inodes; exactly four ad attempts.
- `job-reconciliation.json`: a simulated publication-checkpoint interruption using copies of a real verified MP4; recoverable output accepted, altered resolved copy and corrupt canonical checksum rejected.
- `jobs-final-candidate.json`: fresh final engine/workflow candidate, no-write preflight, real serif/new-emoji/music render, frame-aligned fade (.25 seconds becomes 8/30), complete packaging and idempotent finalize.
- `jobs-partial-verification.json`: deliberate synthetic copy-fit failure, valid remaining render and explicit partial delivery, with complete finalize blocked.
- `form-browser-test.json`: native bridge mocked, zero intermediate follow-ups, one final start-production payload, responsive widths, state restoration and missing-bridge errors. No job starts from this browser test.
- `integration-tests.txt`, `engine-core-tests.txt`, `skill-validation.txt`, package verification and original production inventory comparison retain mechanical evidence.

The first development attempt exposed a scanner bug treating latest-report.json as a work directory. Its immutable diagnostic job/output was preserved; subsequent corrected workflow passed full recovery. Motion QA here uses one-second filmstrips plus decoded frames, not a claim of subjective real-time listening. Real playback/audio listening, installed-plugin invocation, live Drive completeness/auth and a full second-Mac campaign remain pilot acceptance. Node22 minimum, other architectures and minimum macOS/Codex versions remain unverified.

The next milestone is private release staging/verification/refresh/rollback, with separate plugin, engine and assets versions. It must retain active locks and old versions, address compatible recovery migrations, and make local plugin refresh explicit. See [next milestone](NEXT-MILESTONE.md). Nothing was installed into Codex, registered, published or changed in production.
