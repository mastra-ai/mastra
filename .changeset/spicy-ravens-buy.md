---
'mastra': patch
---

Fixed an issue where `mastra dev` ignored user-specified `bundler.externals` (and other bundler options), causing the watcher to fall back to its default preset and fail to bundle certain CommonJS packages (e.g. `tsx`) even when they were listed as externals.

**Before:** `externals` configured in `new Mastra({ bundler: { externals: ["tsx"] } })` was respected by `mastra build` but silently dropped by `mastra dev`.

**After:** `mastra dev` now forwards the user's `externals` and `dynamicPackages` to the watcher, matching the build path.
