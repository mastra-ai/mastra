---
'@mastra/core': minor
---

Fixed evented durable agents stopping when their API process shuts down when using shared storage-backed run fencing. Surviving workers keep run and thread ownership alive and complete terminal cleanup, allowing the next message to start immediately. API shutdown now detaches the API's local participation instead of abandoning a claim a remote worker still holds.

Workers follow only the delivering run's claim or an explicitly declared workflow ancestor. Nested durable agents and sequential runs sharing a `RequestContext` keep independent ownership instead of inheriting unrelated claims. Canceling a suspended run notifies terminal consumers without renewing its released claim, and stale cancellation cannot abort or clean up a successor execution.

Shared deployments without a durable storage generation keep their existing behavior and log a warning once per agent: API shutdown or loss can still interrupt remote workers. These configurations are not rejected, but the API-loss fix does not apply to them. Process-local execution and existing hostless or non-atomic-storage fallbacks are unchanged.

To enable worker continuity across API loss, use a shared fencing-capable adapter, such as `PostgresStore` from `@mastra/pg`, and a shared pubsub transport:

```ts
new Mastra({
  storage: new PostgresStore({ id: 'shared-storage', connectionString }),
  pubsub,
  agents: { agent: createEventedAgent({ agent, pubsub }) },
});
```
