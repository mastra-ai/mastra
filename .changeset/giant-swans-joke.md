---
'@mastra/code-sdk': patch
'@mastra/core': patch
---

The sandbox-backed workspace filesystem now runs `list_files` tree walks and `grep` searches inside the sandbox in a single command (using `find` and `rg`/`grep`), instead of one round trip per directory and file.
