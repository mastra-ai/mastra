---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Added resilient column handling to insert and update operations. Unknown columns in records are now silently dropped instead of causing SQL errors, ensuring forward compatibility when newer domain packages add fields that haven't been migrated yet.

For example, calling `db.insert({ tableName, record: { id: '1', title: 'Hello', futureField: 'value' } })` will silently ignore `futureField` if it doesn't exist in the database table, rather than throwing. The same applies to `update` — unknown fields in the data payload are dropped before building the SQL statement.
