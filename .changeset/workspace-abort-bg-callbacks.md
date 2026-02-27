---
'@mastra/core': minor
---

Abort signal and background process callbacks

- Sandbox commands and spawned processes can now be cancelled via `abortSignal` in command options
- Background processes spawned via `execute_command` now support `onStdout`, `onStderr`, and `onExit` callbacks for streaming output and exit notifications
- New `backgroundProcesses` config in workspace tool options for wiring up background process callbacks
