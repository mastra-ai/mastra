---
'@mastra/core': patch
---

Fixed `LocalSandbox` `execute_command` with a relative `cwd` (e.g. `"."` or `"./subdir"`) resolving against the server's working directory instead of the sandbox's configured `workingDirectory`.
