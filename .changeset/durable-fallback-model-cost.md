---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed the cost that durable agents record. After a model fallback or a model change in `prepareStep`, the model span and its cost metrics now name the model that answered, not the first model. Cost reported by the provider (for example the Vercel AI Gateway) is now used in place of an estimate, and steps of a durable run include `providerMetadata`. Token metrics from an Inngest worker keep their provider, model and cost when `excludeSpanTypes` hides the model span.

Fixed an evented agent stream with remote workers that stayed open after the run ended, when the run ended before its last event reached the caller.
