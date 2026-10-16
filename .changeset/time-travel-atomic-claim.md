---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed `timeTravel()` running the same steps twice when called concurrently on one run. `timeTravel()` now atomically claims the run before executing, like `resume()` does. A losing call throws `WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED` (or `WORKFLOW_TIME_TRAVEL_RUN_RUNNING` if the run is already executing) and `POST /api/workflows/:workflowId/time-travel-async` returns `409 Conflict`. The claim isn't enforced with storage adapters that don't support concurrent updates, when `shouldPersistSnapshot` excludes the `running` status, or in the Inngest runner; concurrent calls there can still run steps twice. Fixes #27279.
