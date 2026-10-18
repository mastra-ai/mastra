---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/pg': patch
---

Observational memory no longer stores a buffered chunk that overlaps work another process already committed. When two processes buffer the same thread at once, the in-memory and Postgres stores now refuse a chunk that re-observes messages already held, ends before an existing chunk, or was read at a cursor that has since moved. Messages that only the refused chunk covered stay unobserved and are picked up by the next buffer.
