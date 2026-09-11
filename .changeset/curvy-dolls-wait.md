---
'@mastra/core': patch
---

Fixed the Workspace execute_command tool discarding stderr on successful exits. Output written to stderr is now preserved and labeled even when a command exits with code 0, so warnings and diagnostics from successful commands and shell pipelines are no longer hidden.
