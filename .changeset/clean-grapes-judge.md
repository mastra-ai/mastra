---
'@mastra/core': patch
---

Fixed durable and evented agent streams to use the shared stream publisher while preserving their existing record keys and owning-reader lifecycle management. New records include stream status and publisher identity; legacy status-less records remain readable for replay authorization only.
