---
'@mastra/pg': patch
---

Fixed PostgreSQL constraint names exceeding 63-byte identifier limit. Schema-prefixed constraint names are now truncated to fit within PostgreSQL's identifier length limit, preventing "relation already exists" errors when restarting the dev server with schema names longer than 13 characters. Fixes #12679.
