---
'@mastra/core': patch
---

Fixed a bug where multiple tools streaming output simultaneously could fail with "WritableStreamDefaultWriter is locked" errors. Tool streaming now works reliably during concurrent tool executions.
