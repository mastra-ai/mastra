---
'@mastra/core': minor
---

Added `scopes` to agents: the addresses a run acts as, written as `<type>:<value>` (for example `org:acme`, `resource:user-123`, `thread:conversation-123`).

**Setting scopes.** Pass them per call on `stream`, `generate`, `network`, `sendMessage`, `queueMessage` and `sendSignal`, set them on the agent, or set them from trusted middleware with the new `MASTRA_SCOPES_KEY` request context key. Mastra combines all three. Read an agent's configured scopes with `agent.getScopes()`.

**Memory.** Memory reads its resource and thread from `resource:` and `thread:` scopes, in addition to `memory.resource`, `memory.thread` and the existing request context keys. If they name different values, the call throws a 400 error instead of silently picking one. Runs with no scopes from any source behave as before.

```ts
const agent = new Agent({
  id: 'support',
  model: 'openai/gpt-5-mini',
  memory: new Memory(),
  scopes: ({ requestContext }) => {
    // Set by your auth middleware. Request bodies can fill unreserved keys, so only read trusted ones.
    const orgId = requestContext.get('org-id');
    return orgId ? [`org:${orgId}`] : [];
  },
});

// Before
await agent.generate('Hi', { memory: { resource: 'user-123', thread: 'conversation-123' } });

// After
await agent.generate('Hi', { scopes: ['resource:user-123', 'thread:conversation-123'] });
```

**Nested calls.** Tools, processors and subagents see the run's other scopes (for example `org:acme`) under `MASTRA_SCOPES_KEY`, but not its `resource:` and `thread:` scopes, so nested agent calls can choose their own thread.

**Suspended runs.** Suspended runs keep their scopes when resumed: a resume may repeat some or all of them but cannot add new ones.

**Upgrading.** Upgrade `@mastra/server` together with this release. While an older server is registered, agents refuse scopes from the call and the request context with an `AGENT_SCOPES_SERVER_OUTDATED` error (HTTP 400); the agent's own `scopes` option still applies. This detection relies on the server registering itself with Mastra, which `@mastra/server` has done since `1.0.0-beta.5`. Servers older than that — and custom server adapters that never call `mastra.setMastraServer()` — are indistinguishable from no server at all, so they are not detected: upgrade them rather than relying on the guard.

Runs suspended before this release have no recorded scope set; resuming one adopts the scopes supplied at resume time (the same trust checks as a fresh run apply) instead of rejecting them. Runs suspended after the upgrade record their set — including the empty set — and a resume may not add to it.
