---
'@mastra/server': minor
---

Added `GET /api/agents/:agentId/signals?threadId=…&resourceId=…` to list queued signals and `DELETE /api/agents/:agentId/signals?threadId=…&resourceId=…` to remove one or more. Both routes are scoped to the selected agent ID and thread and only reflect the in-memory queue of the server process handling the request.

The delete route accepts a JSON body with 1–1,000 non-empty signal IDs:

```json
{ "signalIds": ["signal-1", "signal-2"] }
```

It returns `{ removedSignalIds: string[] }` containing only IDs actually removed, in request order without duplicates. Removal cancels queued delivery without aborting runs or reverting state updates, notification status, or acceptance results.

Fixed request body validation so missing or falsy bodies cannot bypass required route schemas. Bodyless requests remain supported for schemas with optional fields.
