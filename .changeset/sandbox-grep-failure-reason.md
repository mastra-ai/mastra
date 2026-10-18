---
'@mastra/code-sdk': patch
---

Improved sandbox grep reliability and diagnostics. When `rg` or `grep` fails inside the sandbox, the error now says why, for example a timeout or an exit code with the first stderr line. Previously every failure was reported as an unsupported pattern. The POSIX `grep` fallback now skips `.git`, and it keeps matches when only some files could not be read.
