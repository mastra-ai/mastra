---
'@mastra/core': patch
---

Fixed durable agent runs failing during shutdown by waiting for in-flight workflow persistence before closing storage.
