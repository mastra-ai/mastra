---
'@mastra/cloudflare': minor
---

feat: add Cloudflare Durable Objects storage adapter

Adds a new Durable Objects-based storage implementation alongside the existing KV store. Includes SQL-backed persistence via DO's SQLite storage, batch operations, and proper table/column validation.
