---
'@mastra/inngest': patch
---

Flush observability after Inngest workflow finalize step to ensure span export promises resolve before the function completes. Fixes #13388 where fire-and-forget export promises were abandoned in durable execution contexts.
