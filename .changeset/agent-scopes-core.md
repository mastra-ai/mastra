---
'@mastra/core': minor
---

Added `scopes` to agents: the addresses a run acts as, written as `<type>:<value>` (for example `org:acme`, `resource:user-123`, `thread:conversation-123`). Pass them per call on `stream`, `generate`, `network`, `sendMessage`, `queueMessage` and `sendSignal`, set them on the agent, or set them from trusted middleware with the new `MASTRA_SCOPES_KEY` request context key. Mastra combines all three.

Memory now reads its resource and thread from `resource:` and `thread:` scopes, in addition to `memory.resource`, `memory.thread` and the existing request context keys. If they name different values, the call throws a 400 error instead of silently picking one. Runs with no scopes from any source (call, agent or request context) behave as before.

```ts
const agent = new Agent({
  id: 'support',
  model: 'openai/gpt-5-mini',
  memory: new Memory(),
  scopes: ({ requestContext }) => [`org:${requestContext.get('org-id')}`],
});

// Before
await agent.generate('Hi', { memory: { resource: 'user-123', thread: 'conversation-123' } });

// After
await agent.generate('Hi', { scopes: ['resource:user-123', 'thread:conversation-123'] });
```

Tools, processors and subagents see the run's other scopes (for example `org:acme`) under `MASTRA_SCOPES_KEY`, but not its `resource:` and `thread:` scopes, so nested agent calls can choose their own thread. Suspended runs keep their scopes when resumed. When a run has scopes, it works on a copy of the request context, so values the run sets (such as `MastraMemory`) are not written back to the caller's context. Use `agent.getScopes()` to read an agent's configured scopes.
