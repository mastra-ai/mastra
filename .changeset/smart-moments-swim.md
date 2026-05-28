---
'mastra': patch
---

Detect and block duplicate `mastra dev` instances running in the same directory. Instead of failing with a confusing DuckDB file-lock error, the CLI now checks for an existing dev server process via a PID-based lockfile and exits with a clear error message explaining how to resolve the conflict.
