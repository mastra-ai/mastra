---
'@mastra/core': minor
---

feat(workspace): abort signal and background process callbacks

- Add `abortSignal` support to `CommandOptions` so sandbox commands can be cancelled (e.g. on ctrl+C)
- Add `BackgroundProcessConfig` with `onStdout`, `onStderr`, `onExit` callbacks for background processes spawned via `execute_command(background: true)`
- Add `ExecuteCommandToolConfig` type extending `WorkspaceToolConfig` with `backgroundProcesses` config
- Fix `LocalSandboxOptions` to properly omit inherited `processes` option
