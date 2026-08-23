---
'@mastra/core': patch
---

Fixed `Agent.listSuspendedRuns()` and `DurableAgent.listActiveRuns()` ignoring the `resourceId` filter at the storage level. The filter is now pushed down to the workflow storage query instead of being applied in JavaScript after fetching every snapshot in the date range, so scoped polling no longer deserializes unrelated runs. Durable and evented agents now also record the `resourceId` on their workflow runs when they are created. See https://github.com/mastra-ai/mastra/issues/21844
