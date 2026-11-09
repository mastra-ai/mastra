---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed aborting a `DurableAgent` run (from `createDurableAgent`, including evented agents) that is waiting for tool approval when your app runs on more than one server. Before, aborting through `POST /agents/:agentId/runs/:runId/abort` only took effect on the server that handled it, so approving the tool call on another server still ran the tool. The route now records the cancellation in storage, and a later approval or resume of that run is refused with `409 Conflict` (`AGENT_RESUME_ABORTED_RUN`) on any server, so the tool doesn't run. Before, the same-server case returned a `500`.

On storage adapters without concurrent updates, such as Redis, Valkey and LanceDB, the recorded cancellation is best effort: an abort and an approval that arrive at the same moment aren't serialized. Inngest agents aren't covered by this fix.
