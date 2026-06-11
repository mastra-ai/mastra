---
'@mastra/core': minor
---

Migrated the Durable Agent's internal workflow engine from the synchronous workflow to the evented workflow engine. This improves durability and observability of durable agent runs by leveraging the same event-driven architecture used by standard workflows. The change is transparent — existing Durable Agent usage continues to work without any API changes.
