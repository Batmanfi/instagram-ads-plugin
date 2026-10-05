---
name: setup-instagram-ads
description: Check or initialize a teammate's local folders and configure a separately supplied pinned engine for the private Instagram Ads plugin when setup, installation or compatibility is requested.
---

# Set up Instagram Ads

Resolve the installed plugin root from this skill's actual location (`../..`) and invoke its scripts/cli.mjs doctor. Read actual diagnostics before reporting readiness. This candidate supports preparation, final Start production, persistent local jobs, QA and delivery; verified local release staging/activation/rollback are available; actual Codex installation/refresh and another Mac still need validation. Read [portable-engine.md](references/portable-engine.md) when configuring the separate engine. The plugin archive never automatically installs that engine, assets or dependencies.

For an authorized setup request, run init with absolute state/data roots and the teammate's actual IANA timezone. Defaults use their home: Library/Application Support/Instagram Ads for state and Documents/Instagram Ads for Campaigns, Workspace, Renders/Ad-Campaigns, Deliveries and Index. Choose nonoverlapping owned roots outside installed plugin code. Repeating the same init is idempotent; it does not silently overwrite different root/timezone settings.

Initialization does not install Node, FFmpeg, Pillow, Swift, Times New Roman or a browser, register a marketplace, authenticate Drive or publish remotely. Each teammate uses their own private Git/Drive access. Markdown does not require Drive. Verify visualize availability and final follow-up in the actual local desktop chat using the harmless compatibility test; an archive build or browser mock is not a native installation test.

Keep writable records outside versioned code. Engine configuration changes apply to new campaigns/jobs; existing jobs retain their workflow/engine/assets/browser/font locks and outputs. Retain prior versions and snapshots. Do not clean up or replace an active engine. Read [release-updates.md](references/release-updates.md) for authorized local release checks, staging, dependency installation, activation, rollback and the separate Codex refresh step. Never migrate or alter an active job implicitly.
