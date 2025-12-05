---
"@mastra/pg": patch
---

Fix duplicate database object warning when multiple PostgresStore instances use the same connection config. Implement connection caching to reuse pg-promise instances and database objects, preventing warnings in Next.js HMR and suspend/resume scenarios.
