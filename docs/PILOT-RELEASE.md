# Private synthetic pilot — v0.3.0-alpha.1

Source: [Batmanfi/instagram-ads-plugin](https://github.com/Batmanfi/instagram-ads-plugin). Private prerelease: [v0.3.0-alpha.1](https://github.com/Batmanfi/instagram-ads-plugin/releases/tag/v0.3.0-alpha.1). Each teammate needs repository read access and their own GitHub authentication; never distribute an account token.

This is the smallest installable pilot candidate. It retains plugin 0.3.0-alpha.1 and engine 0.2.0-alpha.1, with separately identified generated media. No supplied production scenery/music, system Times New Roman, customer campaigns, outputs, dependencies or local credentials are in the shared source or pilot kit. Generated clips/chords use original filenames and track IDs only as compatibility keys.

## Trusted release values

- Kit: `Instagram-Ads-Synthetic-Pilot-0.3.0-alpha.1.zip`
- ZIP SHA-256: `47b6900651f610720b3bcd7abec9c3ed9034562d8b42a8617afc0b5cc05465be`
- Manifest: `Instagram-Ads-Synthetic-Pilot-0.3.0-alpha.1.json`
- Manifest SHA-256: `41b1263081c705e32be5d6056d850c2598eec36f5d9a73eaf515af18309e3a19`
- Release ID: `88ded67d90ea0b2f1c1736ecd6e6dfa7e619ac979b46c601ee4904e2b4f8017d`
- Plugin/workflow ID: `f2a65398de9a6fbcfb19d8fccb4147b6c02f069c05c0c066260578649dd7afcd`
- Engine content ID: `017106443f9e264bc49de1681f5d22308019a1362d50b7bd56fa76042d00d666`

Check the ZIP checksum against this authenticated private release channel before extracting or running its driver. The driver checks the independently supplied manifest digest and bootstrap source hashes. A checksum included only inside an untrusted download cannot authenticate its publisher. ZIP archive timestamps can differ on rebuild; content IDs describe immutable components, while these exact archive digests describe this release only.

## Teammate sequence

1. Download the pilot ZIP and SHA256SUMS from the private prerelease. Check the ZIP with `shasum -a 256`, extract it, and read START-HERE.md.
2. Run its doctor and setup commands with the trusted manifest digest and actual browser/installed Times New Roman paths. Current candidate supports macOS arm64, Node22–26, npm, FFmpeg/ffprobe, Python+Pillow and Swift command-line tools. Missing requirements fail visibly. Specify `--timezone` when using preexisting settings with a timezone different from the runtime default. Local outputs default to ~/Documents/Instagram Ads; versioned engine/state defaults to ~/Library/Application Support/Instagram Ads.
3. Register/install the private plugin through the supported Codex client on the teammate Mac. Engine setup and Codex plugin installation/refresh are separate actions. See [handoff](GITHUB-HANDOFF.md) and OpenAI links there. Do not claim the plugin is installed merely because the engine is activated.
4. Open the generated local Workspace in Codex. Verify the actual installed setup skill, release-status and harmless native compatibility callback, then submit fixtures/SYNTHETIC-COPY.md. Inspect/audit the actual source, use the real inline form and only start rendering through its final Start production action.
5. Complete all rows in [second-Mac acceptance](SECOND-MAC-ACCEPTANCE.md), including the teammate's own Drive account/full relevant document tabs, update/rollback/skipped versions, interrupted jobs and operation while the maintainer Mac is offline.

## Local verification and limits

The clean source passes 40 automated tests and package/hash/style/path checks. A separate owned local installation produced and delivered all four synthetic fixture ads, including exact punctuation/emoji, compact spacing, all four saved styles, one silent output and three opted-in generated chord tracks. Every output passed H.264/yuv420p/1080×1920/30fps/300-frame/10-second checks and full decode. Fresh beginning/middle/end frames and ten sampled motion tiles per ad were inspected. Delivery includes all four MP4s, contact/inspection sheets, exact archived source/manifests, verification, source ZIP and complete ZIP. Repeated finalize reused the same complete archive checksum.

Complete-delivery ZIP SHA-256: `227535486289950f73261af1aa94fe8dc93c3b757d3b07802ba495959edf0ba4`. Delivery artifacts stay local and are not uploaded as customer deliverables. These are fixed synthetic QA fixtures, not customer copy or approved campaign claims.

Installed Codex discovery/refresh and native final callback, second Mac/account, subjective listening, Google Drive integration on that account and original scenery/music quality are not verified. No Codex settings or plugin installation were changed by preparing this release. Original media distribution requires a separate cleared bundle. The existing production project remains outside this development repository.
