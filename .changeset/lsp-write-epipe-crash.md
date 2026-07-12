---
'@mastra/core': patch
---

Fixed a fatal crash (write EPIPE) when a language server process exits or stops reading while a request is being sent to it. LSP requests now fail with a clean timeout error instead of crashing the host process.
