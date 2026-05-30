---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed observational memory reprocessing previously observed context by letting MessageList assign timestamps to generated assistant responses without rewriting stored response timestamps.
