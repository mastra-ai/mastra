---
'@mastra/core': patch
---

Fixed evented durable agents stopping when their API process shuts down. Surviving workers now keep run and thread ownership alive and complete terminal cleanup, allowing the next message to start immediately.

Shared evented execution now requires a storage adapter with `supportsRunFencing()` and the agent and Mastra host to use the same underlying pubsub transport. Unsupported shared configurations are rejected before dispatch. Process-local execution and existing hostless or non-atomic-storage fallbacks are unchanged.
