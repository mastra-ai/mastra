---
'@mastra/memory': patch
---

Fixed thread deletion so it also removes observational memory vectors. Deleting a thread now clears its vectors from both the message indexes and the observation indexes, so text from a deleted thread is no longer returned by resource-scoped search. Deleting a single message still touches only the message indexes.

Improved the report of a failed cleanup. If a vector store cannot delete from one index, thread deletion still succeeds and now logs a warning that names the index and the thread.
