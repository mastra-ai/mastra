---
'@mastra/core': patch
---

Fixed a crash that could happen when a language server process exited or stopped responding while a request was being sent to it. The request now fails with a clean timeout error instead of crashing the host process.
