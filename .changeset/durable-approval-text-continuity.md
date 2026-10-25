---
'@mastra/core': patch
---

Restore text streamed before tool approval in resumed durable and evented agent output. Streams configured to close on suspension settle their partial results; streams kept open continue through approval. Earlier completed iterations are not added to the resumed stream's `steps`.
