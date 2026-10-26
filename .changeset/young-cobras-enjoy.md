---
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mssql': minor
'@mastra/mysql': minor
'@mastra/cloudflare-d1': minor
'@mastra/cloudflare': minor
'@mastra/lance': minor
'@mastra/mongodb': minor
'@mastra/convex': minor
'@mastra/dynamodb': minor
'@mastra/upstash': minor
---

Added storage for the optional background task fields `expiresAt` and `metadata`, plus filtering by `expiresAt`. Existing tables and collections gain the new fields automatically when the store initializes, and existing tasks keep using the global retention settings. Requires the matching `@mastra/core` release.

Convex users must redeploy their Convex schema after upgrading, because the adapter now writes the `expiresAt` and `metadata` fields.
