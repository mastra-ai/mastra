---
'mastra': minor
---

Added build staleness detection to deploy commands. The CLI now computes a SHA-256 hash of source files after each build and stores it in `.mastra/build-manifest.json`. When deploying, it compares the current source hash against the stored hash — if they differ, the build is automatically re-run. This prevents deploying outdated builds when source files have changed.

If you use `--skip-build` but source has changed, the CLI warns you and forces a rebuild anyway.
