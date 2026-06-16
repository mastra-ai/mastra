---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/mysql': patch
---

Add item-level static tool mocks for deterministic agent experiments. Dataset items can carry `toolMocks` (toolName + args + output, with a `matchArgs` mode of `strict` or `ignore`); the experiment engine serves the mocked output in place of the real tool, consumes mocks in order per (toolName, args), and aborts the item on mismatch/exhaustion. A per-item `toolMockReport` records served/unconsumed/live calls. Persisted on libsql, pg, mongodb, and spanner; mysql explicitly rejects tool mocks rather than dropping them silently.
