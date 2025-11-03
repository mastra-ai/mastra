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

Migration: Replace `getMessagesPaginated({ threadId, selectBy: { pagination: { page, perPage } } })` with `listMessages({ threadId, page, perPage })`. Client SDK: Replace `thread.getMessagesPaginated()` with `thread.listMessages()`.
