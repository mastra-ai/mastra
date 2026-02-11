---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/upstash': minor
'@mastra/mssql': minor
'@mastra/convex': minor
'@mastra/lance': minor
'@mastra/cloudflare': minor
'@mastra/cloudflare-d1': minor
'@mastra/clickhouse': minor
'@mastra/server': patch
---

Added `lastMessageAt` field to threads. This nullable timestamp only updates when new messages are saved to a thread, unlike `updatedAt` which also changes on title/metadata edits. Enables sorting threads by last message time via `orderBy: { field: 'lastMessageAt', direction: 'DESC' }`. New threads and existing threads without messages will have `lastMessageAt` as `null`.
