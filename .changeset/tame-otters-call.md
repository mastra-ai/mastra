---
'@mastra/core': patch
---

Fixed `createStep(agent)` running a `durable: true` agent as a plain agent. When the agent is registered with Mastra, the workflow step now runs through the registered durable wrapper on both the default and evented engines, so durable streaming and cleanup apply as expected.
