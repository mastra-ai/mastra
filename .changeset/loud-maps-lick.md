---
'mastra': patch
---

Fixed `mastra server deploy` and `mastra studio deploy` failing when deploying from a subdirectory (e.g. `mastra server deploy src`).
Added `--debug` flag to both deploy commands for verbose build logs.
Fixed build errors displaying as `error: {}` instead of the actual error message.
