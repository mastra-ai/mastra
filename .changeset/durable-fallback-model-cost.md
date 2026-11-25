---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed the cost that durable agents record. After a model fallback or a model change in `prepareStep`, the model span and its cost metrics now name the model that answered, not the first model. Cost reported by the provider (for example the Vercel AI Gateway) is now used in place of an estimate. Token metrics from an Inngest worker keep their provider, model and cost when `excludeSpanTypes` hides the model span.
