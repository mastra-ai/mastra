---
'@mastra/pg': minor
---

PostgreSQL now stores channel thread mappings in a new `mastra_channel_threads` table (created automatically by `init()`), so channel conversations resolve to their Mastra thread with an indexed lookup instead of a scan of every thread's metadata.
