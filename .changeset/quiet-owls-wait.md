---
'@mastra/e2b': patch
'@mastra/platform-workspace': patch
---

Fixed background processes losing output, and `wait()` failing, when a command wrote output as soon as it started. Output that arrived before the process handle was ready was dropped with an error; it now reaches `stdout`, `stderr` and the `onStdout`/`onStderr` callbacks like any other output. This applies to `sandbox.processes.spawn()` and to attaching with `sandbox.processes.get(pid)`.
