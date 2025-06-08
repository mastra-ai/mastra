---
'@mastra/cloudflare-d1': minor
'@mastra/clickhouse': minor
'@mastra/dynamodb': minor
'@mastra/mongodb': minor
'@mastra/upstash': minor
'@mastra/pg': minor
---

Thread Timestamp Auto-Update Enhancement
Added automatic thread updatedAt timestamp updates when messages are saved across all storage providers
Enhanced user experience: Threads now accurately reflect their latest activity with automatic timestamp updates when new messages are added
Universal implementation: Consistent behavior across all 7 storage backends (ClickHouse, Cloudflare D1, DynamoDB, MongoDB, PostgreSQL, Upstash, LibSQL)
Performance optimized: Updates execute in parallel with message saving operations for minimal performance impact
Backwards compatible: No breaking changes - existing code continues to work unchanged
Improved conversation ordering: Chat interfaces can now properly sort threads by actual last activity
This enhancement resolves the issue where active conversations appeared stale due to outdated thread timestamps, providing better conversation management and user experience in chat applications.
