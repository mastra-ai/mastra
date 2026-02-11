---
'@mastra/core': patch
---

Fixed messages not being persisted to the database when using the stream-legacy endpoint. The thread is now saved to the database immediately when created, preventing a race condition where storage backends like PostgreSQL would reject message inserts because the thread didn't exist yet. Fixes #12566.
