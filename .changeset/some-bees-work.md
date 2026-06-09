---
'@mastra/libsql': patch
---

Fixed concurrent writes silently disappearing when using LibSQL with a local (`file:`) database.

LibSQL backs a local database with a single connection. When one operation held an interactive write transaction (for example, persisting workflow snapshots) and another operation wrote at the same time (for example, creating a dataset experiment), the second write could be swept into the open transaction and rolled back — so it appeared to succeed but never persisted. This surfaced as concurrent agent/workflow runs losing unrelated records.

Writes on a LibSQL client are now serialized, so a write issued during an in-flight transaction no longer interleaves with it.
