---
'@mastra/server': patch
'@mastra/client-js': patch
---

Added HTTP and client bindings for recovering an interrupted durable agent run.

**What changed**

- `@mastra/server`: new `POST /agents/:agentId/recover` route. Given the id of a durable agent run that was interrupted by a deploy or crash, the server picks the run back up from where it left off and streams the rest of the response to the caller. Non-durable agents are rejected, and callers can only recover runs that belong to them (same permission and ownership rules as resuming a suspended run).
- `@mastra/client-js`: new `agent.recover({ runId })` method that reads that stream from the browser or Node. It behaves the same as `agent.resumeStream()` — you get back a readable stream of the agent's remaining response.

**Why**

The underlying core API for recovering an interrupted durable agent run could previously only be called from server-side code. This adds the standard HTTP + client surface so operators can reattach to an interrupted run from a dashboard, an admin tool, or any other client, using the same auth and ownership rules as the rest of the agents API.

**Usage**

```ts
const stream = await mastraClient.getAgent('support').recover({ runId: 'run-abc123' });
for await (const chunk of stream) {
  // render or forward the remaining agent output
}
```
