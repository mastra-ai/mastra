---
'@mastra/core': patch
'@mastra/inngest': patch
---

Reuse core's shared agent stream bus for Inngest agents. Expose an internal `@mastra/core/agent/streams` bridge and preserve Inngest's transport, replay cache, and agent-topic routing while removing duplicate stream setup.

Release ordering: publish the core bridge before releasing this Inngest change, then raise Inngest's `@mastra/core` peer minimum to that verified release and rerun `pnpm check:core-imports workflows/inngest`. Neither core 1.82.0 nor 1.83.0-alpha.0 exports this bridge; the compatible peer minimum must not be inferred from those versions.
