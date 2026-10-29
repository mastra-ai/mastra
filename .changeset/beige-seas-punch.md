---
'@mastra/core': minor
---

Fixed evented durable agents stopping when their API process shuts down when using shared storage-backed run fencing. Surviving workers keep run and thread ownership alive and complete terminal cleanup, allowing the next message to start immediately.

Shared deployments without a durable storage generation keep their existing behavior and log a warning once per agent: API shutdown or loss can still interrupt remote workers. These configurations are not rejected, but the API-loss fix does not apply to them. Process-local execution and existing hostless or non-atomic-storage fallbacks are unchanged.

Caller-provided durable and evented agent `runId` values must not contain the reserved `\u0000retake\u0000` lease delimiter or end with `\u0000retake`. Invalid IDs reject with a `TypeError` before preparation, ownership claims, resume registration, or idle-stream replacement.

To enable worker continuity across API loss, use a shared fencing-capable adapter, such as `PostgresStore` from `@mastra/pg`, and a shared pubsub transport:

```ts
new Mastra({
  storage: new PostgresStore({ id: 'shared-storage', connectionString }),
  pubsub,
  agents: { agent: createEventedAgent({ agent, pubsub }) },
});
```
