---
'mastra': patch
---

Warn before overwriting existing environment variables during `mastra deploy`. When an env file provides variables whose values differ from those already stored on the target environment, the CLI now lists the affected keys and asks for confirmation before uploading (skipped with `--yes` or in headless mode).
