---
'@mastra/core': patch
'@mastra/inngest': patch
---

Durable agent turns now use far fewer Inngest steps, including when observability is not configured. A 20-step agent turn previously used 133–158 Inngest steps.
