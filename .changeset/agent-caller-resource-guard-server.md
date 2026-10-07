---
'@mastra/server': patch
---

Fixed the `/agents/:agentId/signals`, `/send-message` and `/queue-message` routes accepting a `runId` that belongs to another resource's run. These routes now return a 403 when the resource id in the request context does not own the run.

The agent controller tool-approval, tool-suspension and steer routes now also return a 403 when the request context's resource id does not match the session resource in the URL. The check runs before the session is loaded, so a pending approval or suspension is never answered and no session is created for the other resource.
