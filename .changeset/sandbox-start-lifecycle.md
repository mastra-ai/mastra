---
'@mastra/core': minor
'@mastra/e2b': patch
'@mastra/daytona': patch
'@mastra/platform-workspace': patch
'@mastra/railway': patch
---

`MastraSandbox` now owns the start lifecycle: subclass `start()` is constructor-wrapped so direct calls get in-flight coalescing (cleared on settle, failures never latched), status transitions, and mount processing. `start()` may report a `SandboxStartResult { created }` — `false` on reconnect/resume, `true` for a fresh VM — which is forwarded to the `onStart` hook. A new `bootstrap` option runs a command once per VM lifetime, guarded by a sentinel file when the provider doesn't report `created`; credentials go in `bootstrap.env`, never the command string. E2B, Daytona, Local, Platform, and Railway sandboxes report `created`; Platform and Railway drop their hand-rolled start coalescing, and Daytona's redundant `executeCommand` override (which leaked process handles) is removed in favor of the base default.
