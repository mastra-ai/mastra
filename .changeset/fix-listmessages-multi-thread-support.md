---
'@mastra/core': minor
'@mastra/memory': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/convex': patch
'@mastra/dynamodb': patch
'@mastra/lance': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/pg': patch
'@mastra/upstash': minor
---

- Fixed TypeScript errors where `threadId: string | string[]` was being passed to places expecting `Scalar` type
- Added proper multi-thread support for `listMessages` across all adapters when `threadId` is an array
- Updated `_getIncludedMessages` to look up message threadId by ID (since message IDs are globally unique)
- **upstash**: Added `msg-idx:{messageId}` index for O(1) message lookups (backwards compatible with fallback to scan for old messages, with automatic backfill)

