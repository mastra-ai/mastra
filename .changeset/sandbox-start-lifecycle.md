---
'@mastra/core': minor
'@mastra/e2b': patch
'@mastra/daytona': patch
'@mastra/platform-workspace': patch
'@mastra/railway': patch
---

`MastraSandbox` now owns the start lifecycle: subclass `start()` is constructor-wrapped so direct calls get in-flight coalescing (cleared on settle, failures never latched), status transitions, and mount processing. Providers plug in at one of three rungs: optional `find()`/`connect()`/`create()` acquisition primitives with base-orchestrated getOrCreate and a structurally derived `SandboxStartResult { created }` (E2B, Daytona, Local); a `start()` override returning the result for fused-getOrCreate APIs (Platform, Railway); or a void `start()` override (unchanged legacy behavior). The result is forwarded to the `onStart` hook, and BREAKING: `onStart` errors are now fatal — a thrown hook rejects `start()` and marks the sandbox `error` (previously they were logged and swallowed), making `onStart` the seam for once-per-VM setup that must fail loudly. `onStop`/`onDestroy` remain non-fatal. Platform and Railway drop their hand-rolled start coalescing, and Daytona's redundant `executeCommand` override (which leaked process handles) is removed in favor of the base default — Daytona `executeCommand` results now carry the joined command string in `command` and no longer include an `args` array, matching every other provider.
