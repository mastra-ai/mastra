---
'@mastra/core': major
'@mastra/server': major
'@mastra/deployer': major
'@mastra/client-js': major
'@mastra/memory': major
'@mastra/pg': major
'@mastra/mongodb': major
'@mastra/clickhouse': major
'@mastra/cloudflare': major
'@mastra/cloudflare-d1': major
'@mastra/dynamodb': major
'@mastra/lance': major
'@mastra/libsql': major
'@mastra/mssql': major
'@mastra/upstash': major
'@mastra/longmemeval': major
---

**BREAKING:** Remove `getMessagesPaginated()` in favor of `listMessages()` API

The deprecated `getMessagesPaginated` method has been removed from all storage implementations. Use `listMessages()` instead, which provides better pagination support with `perPage: false` for fetching all records and improved filtering options.

**BREAKING:** Stricter `threadId` validation in `listMessages()`

The new `listMessages()` method validates that `threadId` is a non-empty, non-whitespace string and throws an error if validation fails. Previously, `getMessagesPaginated()` would silently return empty results for empty or whitespace-only `threadId` values.

Migration:
- Replace `getMessagesPaginated({ threadId, selectBy: { pagination: { page, perPage } } })` with `listMessages({ threadId, page, perPage })`
- Client SDK: Replace `thread.getMessagesPaginated()` with `thread.listMessages()`
- Ensure all `threadId` values passed to `listMessages()` are non-empty strings (trim whitespace before calling if needed)
