---
'@mastra/stagehand': minor
---

Added automatic cleanup on browser close to prevent common issues when using browser profiles.

- **Exit type patching** — Patches Chrome's `exit_type` to `Normal` after close, preventing the "Chrome didn't shut down correctly" restore dialog on next launch. This is needed because Stagehand's underlying chrome-launcher kills Chrome with SIGKILL.
- **Orphaned process cleanup** — Kills lingering Chrome child processes (GPU, renderer, crashpad) on close to prevent zombie processes.
- **Reliable disconnect detection** — Uses CDP `Target.targetDestroyed` events instead of Playwright events for detecting when the browser is closed externally (e.g. user clicks X). Works in both shared and thread scope.
