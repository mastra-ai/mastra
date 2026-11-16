---
'@mastra/libsql': patch
---

Fixed thread metadata updates dropping keys when two writers update the same thread at the same time, whether in one process or across processes. Updating a thread reads the stored metadata, merges the new keys and writes the whole object back, and that read was not held by the write, so two overlapping updates both started from the same snapshot and the later write discarded the earlier one's keys. `updateThread` and `updateThreadMetadata` now do the read, merge and write inside a single write transaction, so concurrent updates no longer lose each other's keys.
