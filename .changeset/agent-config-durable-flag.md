---
'@mastra/core': patch
---

Added a `durable` field to `AgentConfig` so an agent can opt into durable execution without a separate `createDurableAgent` call. Setting `durable: true` (or `durable: { cache, pubsub, maxSteps, cleanupTimeoutMs }`) auto-wraps the agent with `createDurableAgent` when it is attached to a `Mastra` instance; the factory function remains available for advanced use.
