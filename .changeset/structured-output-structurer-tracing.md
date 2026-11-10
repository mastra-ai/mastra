---
'@mastra/core': patch
---

Fixed the token usage and cost of the `structuredOutput` structuring model call going missing from traces. When you set `structuredOutput.model`, the extra model call that turns the response into your schema was hidden as an internal span, so exporters such as Braintrust and Langfuse never saw its tokens or cost. That call now shows up as a `MODEL_GENERATION` span under the `Structured Output` processor span in the same trace, with its usage, while the internal agent and workflow spans stay hidden. Your request context is now also passed to the structuring call, so values listed in `requestContextKeys` appear as metadata on its spans.
