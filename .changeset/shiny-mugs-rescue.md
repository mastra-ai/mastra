---
'@mastra/server': patch
---

Fixed @mastra/server compatibility by requiring @mastra/core 1.58.0 or newer. Older versions of @mastra/core are missing functionality that @mastra/server depends on, so installing them together resulted in a broken setup rather than a clear version conflict.
