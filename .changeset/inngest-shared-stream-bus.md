---
'@mastra/inngest': patch
---

Reuse core's shared agent stream bus for Inngest agents while preserving Inngest's transport, replay cache, and agent-topic routing. Raise the `@mastra/core` peer minimum to `>=1.83.0-0 <2.0.0-0` for the shared stream-bus integration.
