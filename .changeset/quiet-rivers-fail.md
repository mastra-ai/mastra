---
'@mastra/inngest': patch
---

Inngest workflow and durable agent runs that Inngest gives up on are now marked `failed` in storage. Previously, a run whose worker crashed or ran out of retries before finishing stayed `running` forever, so it showed up as a phantom running run and `observe()` never closed.
