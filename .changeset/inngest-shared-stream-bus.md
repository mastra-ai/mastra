---
'@mastra/inngest': patch
---

Reuse core's shared agent stream bus for Inngest agents while preserving Inngest's transport, replay cache, and agent-topic routing. Require `@mastra/core >=1.83.0 <2.0.0-0` so the peer range excludes prereleases without the shared stream-bus bridge.
