---
'@mastra/core': minor
'@mastra/e2b': patch
'@mastra/daytona': patch
'@mastra/platform-workspace': patch
'@mastra/railway': patch
---

`onStart` errors are now fatal. A thrown hook rejects `start()` and marks the sandbox `error`, where previously the error was logged and swallowed and the caller got a running sandbox whose setup had failed. This makes `onStart` the seam for once-per-VM setup that must fail loudly. `onStop` and `onDestroy` remain non-fatal, since teardown proceeds best-effort.

`MastraSandbox` now owns the start lifecycle. Subclass `start()` is constructor-wrapped, so direct calls get the same in-flight coalescing (cleared on settle, so a failed attempt is never latched), status transitions, and mount processing that `ensureRunning()` already had.

Providers plug in at one of three rungs: optional `find()`, `connect()` and `create()` acquisition primitives, with the base orchestrating getOrCreate and deriving `SandboxStartResult { outcome: 'created' | 'connected' }` structurally (E2B, Daytona, Local); a `start()` override returning that result, for SDKs whose getOrCreate is fused (Platform, Railway); or a void `start()` override, which keeps today's behavior. The outcome reaches the `onStart` hook, so setup can tell a fresh VM from a reconnect.

New `setOnStart(update)` attaches a start hook after construction, so a runtime that receives a sandbox it didn't build can install setup without every host threading a hook through the provider constructor. The updater receives the currently installed hook and returns its replacement, so callers compose rather than clobber:

```typescript
sandbox.setOnStart?.(previous => async args => {
  await runSetup(args)
  await previous?.(args)
})
```

Platform and Railway drop their hand-rolled start coalescing. Daytona's redundant `executeCommand` override, which leaked process handles, is removed in favor of the base default, so Daytona results now carry the joined command string in `command` and no longer include an `args` array, matching every other provider.
