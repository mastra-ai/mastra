---
'@mastra/pg': patch
---

Fixed standalone storage domains (`MemoryPG`, `WorkflowsPG`, `ObservabilityPG`, and others) ignoring an explicit `ssl` option when the connection string contains `sslmode=`. Passing `ssl: { rejectUnauthorized: false }` now works against servers with self-signed or private-CA certificates, matching `PostgresStore`.
