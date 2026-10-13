---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed durable, evented, and Inngest agents leaking one run's messages into another run's model prompt when two Mastra instances in the same process reuse a `runId`.
