---
'@mastra/core': patch
'@mastra/inngest': patch
---

Reuse core's shared agent stream bus for Inngest agents. Expose an internal `@mastra/core/agent/streams` bridge and preserve Inngest's transport, replay cache, and agent-topic routing while removing duplicate stream setup.

Raise Inngest's `@mastra/core` peer minimum to `>=1.83.0-0 <2.0.0-0` for the shared stream-bus integration.
