---
'@mastra/core': patch
---

Fixed `execute_command` and `get_process_output` results for commands stopped by an aborted run. The result now says the command was aborted instead of showing only a kill exit code such as `Exit code: 128`, which agents mistook for a real command failure. This covers foreground commands, background processes killed when the run that started them is aborted, and processes killed while `get_process_output` was waiting on them.

`get_process_output` on a background process that exited without printing anything now returns its exit status (for example `Exit code: 0`) instead of `(no output yet)`, so it no longer looks like the process is still running.
