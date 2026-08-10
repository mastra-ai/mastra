---
'@mastra/pg': patch
---

Add a persistent `threadState` domain to `PostgresStore`

`PostgresStore` did not register a `threadState` domain, so durable task and goal
state fell back to in-memory storage and was lost on restart. Anything relying on
thread state (task tools, long-running agent goals) could not be backed by Postgres
alone, and required composing a second adapter through `MastraCompositeStore`.

`ThreadStatePG` now stores state as JSONB keyed by `(threadId, type)` with an atomic
upsert that preserves `createdAt`, participates in `exportSchemas()` and `init()`, and
supports retention pruning anchored on `updatedAtZ` so state for still-active threads
survives age-based pruning.
