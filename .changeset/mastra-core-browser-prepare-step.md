---
"@mastra/core": patch
---

Added `getPrepareStep()` to `MastraBrowser`. Agents now use a browser's `prepareStep` by default when `new Agent({ browser })` is configured. A user-supplied `prepareStep` (per-call or in `defaultOptions`) still takes precedence.
