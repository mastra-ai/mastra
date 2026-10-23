---
'@mastra/server-adapters-test-suite': patch
---

Skipped the run-scoped abort route (`POST /agents/:agentId/runs/:runId/abort`) in the generic adapter route suite, since it returns 501 for the suite's non-durable agent by design. Adapter suites no longer fail on this route.
