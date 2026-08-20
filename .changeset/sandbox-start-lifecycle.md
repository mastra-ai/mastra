---
'@mastra/core': minor
'@mastra/e2b': patch
'@mastra/daytona': patch
'@mastra/platform-workspace': patch
'@mastra/railway': patch
---

`MastraSandbox` now owns the start lifecycle: subclass `start()` is constructor-wrapped so direct calls get in-flight coalescing (cleared on settle, failures never latched), status transitions, and mount processing. Providers plug in at one of three rungs: optional `find()`/`connect()`/`create()` acquisition primitives with base-orchestrated getOrCreate and a structurally derived `SandboxStartResult { created }` (E2B, Daytona, Local); a `start()` override returning the result for fused-getOrCreate APIs (Platform, Railway); or a void `start()` override (unchanged legacy behavior). The result is forwarded to the `onStart` hook. A new `bootstrap` option runs a command once per VM lifetime (requires the primitives rung; the constructor throws otherwise): the create branch runs it directly, the connect branch is guarded by a completion marker folded into a single exec, and `LocalSandbox` stores the marker via host filesystem calls. Credentials go in `bootstrap.env`, never the command string. Platform and Railway drop their hand-rolled start coalescing, and Daytona's redundant `executeCommand` override (which leaked process handles) is removed in favor of the base default — Daytona `executeCommand` results now carry the joined command string in `command` and no longer include an `args` array, matching every other provider.
