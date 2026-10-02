---
'@mastra/core': patch
---

Fixed `execute_command` results for commands stopped by an aborted run. The result now says the command was aborted instead of showing only a kill exit code such as `Exit code: 128`, which agents mistook for a real command failure.
