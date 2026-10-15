---
'@mastra/core': patch
---

Fixed `createStep(agent)` running a `durable: true` agent as a plain agent. When the agent is registered with Mastra, the workflow step now runs through the registered durable wrapper on both the default and evented engines, so durable streaming and cleanup apply as expected.

A step now logs a warning when a `durable: true` agent still has to run non-durably: when no durable wrapper for it is registered on the workflow's Mastra instance, or when it uses a legacy v1 model.
