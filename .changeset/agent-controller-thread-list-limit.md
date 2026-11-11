---
'@mastra/core': patch
'@mastra/server': patch
---

A positive `limit` on a session's thread list now reads an expanding, sorted prefix of storage rows until enough eligible threads are found, rather than loading every thread. Session recovery uses the same bounded search where storage can filter by scope. In-memory storage still scans its thread map once, and searches may read more than `limit` rows when forked threads or metadata matches are excluded.
