---
'@mastra/core': patch
'@mastra/inngest': patch
---

Reduced Inngest step usage for durable agents. A 20-step agent turn previously used 133–158 Inngest steps because no-op bookkeeping was wrapped in durable steps. Agent workflows now disable step events, their deterministic snapshot policy is evaluated before entering a durable step, step-start bookkeeping skips the durable step when nothing is published, and span hooks skip it when observability is not configured.
