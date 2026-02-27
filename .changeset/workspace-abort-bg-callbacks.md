---
'@mastra/core': minor
'@mastra/blaxel': patch
---

feat(workspace): abort signal and background process callbacks

- Add `abortSignal` support to `CommandOptions` so sandbox commands can be cancelled (e.g. on ctrl+C)
- Add abort signal handling in base `SandboxProcessManager` so all providers (Local, E2B, Daytona, Blaxel) get automatic abort support via `handle.kill()`
- Add abort signal support to Blaxel's `executeCommand` override
- Add `BackgroundProcessConfig` with `onStdout`, `onStderr`, `onExit` callbacks for background processes spawned via `execute_command(background: true)`
- Add `ExecuteCommandToolConfig` type extending `WorkspaceToolConfig` with `backgroundProcesses` config
- Fix `LocalSandboxOptions` to properly omit inherited `processes` option
