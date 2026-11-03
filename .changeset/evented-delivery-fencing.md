---
'@mastra/core': minor
---

Fixed evented durable agents stopping when the API process shuts down. Workers now keep running the agent, finish cleanup, and free the thread, so the next message starts right away.

Each run keeps its own ownership. Nested durable agents and runs that share a `RequestContext` no longer pick up each other's ownership. Canceling a suspended run still notifies listeners, and a late cancel can no longer stop a newer run of the same agent.

This needs storage that supports run fencing. Other shared setups keep their current behavior and log a warning once per agent: API shutdown can still stop remote workers. Single-process setups are unchanged.

To enable worker continuity across API loss, use a shared fencing-capable adapter, such as `PostgresStore` from `@mastra/pg`, and a shared pubsub transport:

```ts
new Mastra({
  storage: new PostgresStore({ id: 'shared-storage', connectionString }),
  pubsub,
  agents: { agent: createEventedAgent({ agent, pubsub }) },
});
```
