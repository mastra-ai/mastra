---
'@mastra/core': minor
---

Fixed evented durable agents stopping when their API process shuts down. Surviving workers now keep run and thread ownership alive and complete terminal cleanup, allowing the next message to start immediately.

Shared evented execution now requires a shared storage adapter with `supportsRunFencing()` and the agent and Mastra host to use the same underlying pubsub transport. Unsupported shared configurations are rejected before dispatch. Process-local execution and existing hostless or non-atomic-storage fallbacks are unchanged.

**Migration**

Before: an unfenced store or separate agent transport could be configured for shared execution:

```ts
new Mastra({
  storage: unfencedStorage,
  pubsub,
  agents: { agent: createEventedAgent({ agent, pubsub: privatePubsub }) },
});
```

After: use a shared fencing-capable adapter, such as `PostgresStore` from `@mastra/pg`, and the same transport on the agent and host:

```ts
new Mastra({
  storage: new PostgresStore({ id: 'shared-storage', connectionString }),
  pubsub,
  agents: { agent: createEventedAgent({ agent, pubsub }) },
});
```
