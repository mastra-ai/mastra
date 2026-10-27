---
'@mastra/core': patch
---

Moved the agent stream layer (stream topics, event publishing, replay cache setup and abort requests) out of `DurableAgent` into a shared internal module. No behavior change; existing `@mastra/core/agent/durable` exports are unchanged.
