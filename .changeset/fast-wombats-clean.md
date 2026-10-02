---
'@mastra/core': patch
---

Fixed `execute_command` and `get_process_output` results for commands stopped by an aborted run. The result now says the command was aborted instead of showing only a kill exit code such as `Exit code: 128`, which agents mistook for a real command failure. This covers foreground commands, background processes killed when the run that started them is aborted, and processes killed while `get_process_output` was waiting on them.

Sandbox providers: `ProcessHandle` now has a `killedByAbort` getter and a `killForAbort()` method. The process manager and `wait({ abortSignal })` call `killForAbort()` instead of `kill()` when an abort signal fires, so the result can explain why the process stopped. Calling `kill()` directly, as `kill_process` does, does not set `killedByAbort`.
