---
'@mastra/core': patch
'@mastra/inngest': patch
---

Reduced Inngest step usage for durable agents. A 20-step agent turn previously used 133–158 Inngest steps because no-op bookkeeping was wrapped in durable steps. Agent workflows now disable step events, snapshot persistence and step-start bookkeeping skip the durable step when nothing is written or published, and span hooks skip it when observability is not configured.
