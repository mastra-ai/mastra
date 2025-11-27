---
'@mastra/pg': patch
'@mastra/mssql': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/dynamodb': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare-d1': patch
---

Fix message sorting in getMessagesPaginated when using semantic recall (include parameter). Messages are now always sorted by createdAt after combining paginated and included messages, ensuring correct chronological ordering of conversation history. All stores now consistently use MessageList for deduplication followed by explicit sorting.
