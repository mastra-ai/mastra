---
'@mastra/core': patch
---

- Use evented-workflow engine in the internal agentic loop.
- Fix nested workflow resume with resumeLabel in evented-workflow engine.
- Default to an in-memory store when no `storage` is configured on `Mastra`, and warn that it is not durable and a persistent storage adapter should be used in production.
