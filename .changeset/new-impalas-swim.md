---
'@mastra/pg': patch
---

Fixed thread and message timestamp handling to use timezone-aware columns (TIMESTAMPTZ) for sorting and date range filtering. Previously, ORDER BY and date range queries used TIMESTAMP columns which could produce incorrect ordering when the PostgreSQL server timezone differs from UTC. Also fixed timestamp values passed to UPDATE queries to use Date objects instead of ISO strings, preventing timezone information from being stripped when stored in TIMESTAMP columns.
