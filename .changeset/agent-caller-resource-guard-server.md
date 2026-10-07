---
'@mastra/server': patch
---

Fixed the `/agents/:agentId/signals`, `/send-message` and `/queue-message` routes accepting a `runId` that belongs to another resource's run. These routes now return a 403 when the resource id in the request context does not own the run.

The agent controller tool-approval route now also returns a 403 when the request context's resource id does not own the session, before the pending approval is answered.
