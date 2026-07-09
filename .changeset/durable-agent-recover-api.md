---
'@mastra/server': patch
'@mastra/client-js': patch
---

Added HTTP + client bindings for `DurableAgent.recover()`.

**What changed**

- `@mastra/server`: new `POST /agents/:agentId/recover` route (requires `agents:execute`). Body accepts `{ runId, requestContext?, versions? }` and streams the recovered run's `fullStream` as SSE. Rejects non-durable agents with 400 and cross-tenant runs with 403 — honors the reserved `resourceId` on the server request context and validates the persisted `durable-agentic-loop` snapshot's ownership before invoking `agent.recover()`.
- `@mastra/client-js`: new `agent.recover({ runId, requestContext?, versions?, signal? })` method mirroring `agent.resumeStream()`. Returns a `ReadableStream` piped from the SSE endpoint so browser/node callers can drain a recovered durable-agent run without touching the server-side class directly.

**Why**

The core `DurableAgent.recover(runId)` API added in the paired `@mastra/core` changeset was only reachable from in-process code. Exposing it over the standard agents HTTP surface (and via the official client) lets operators reattach to an orphaned `RUNNING` durable run from anywhere the rest of the agents API is already reachable — dashboards, CLI tools, admin endpoints — with the same auth, ownership, and version-override semantics as `resumeStream`.

**Usage**

```ts
// From a browser / node client via @mastra/client-js:
const stream = await mastraClient.getAgent('support').recover({ runId: 'run-abc123' });
for await (const chunk of stream) {
  // handle SSE frames
}
```
