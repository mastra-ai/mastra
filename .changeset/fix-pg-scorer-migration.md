---
"@mastra/pg": patch
---

Fixed PostgreSQL migration errors when upgrading from v0.x to v1

**What changed:** PostgreSQL storage now automatically adds missing `spanId` and `requestContext` columns to the scorers table during initialization, preventing "column does not exist" errors when upgrading from v0.x to v1.0.0.

**Why:** Previously, upgrading to v1 could fail with errors like `column "requestContext" of relation "mastra_scorers" does not exist` if your database was created with an older version.

Related: #11631
