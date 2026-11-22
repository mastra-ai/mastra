---
'@mastra/core': patch
---

Durable and evented agents now generate a thread title for observational-memory runs, as a regular Agent does. A title is only written to a thread that already exists, so an observational-memory run never creates a thread holding just a title.
