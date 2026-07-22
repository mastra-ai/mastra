---
'create-factory': patch
---

Add `--skip-verify` and `--local-workspace` flags to `sync-template.mjs` for local template iteration when a linked dependency has not yet been published to npm. `--skip-verify` bypasses the publish check (caret ranges still written from local monorepo versions). `--local-workspace` implies `--skip-verify` and additionally rewrites any unpublished dep to a `file:` path anchored on the monorepo package so the generated template installs and runs without needing an npm publish first. Default and CI behavior is unchanged: the publish check still runs and still fails loudly when a dep is missing on npm, and error messages now point users to the new flags.
