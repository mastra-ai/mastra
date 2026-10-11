---
'@mastra/core': patch
---

Fixed `response.id` being lost when a model provider (for example OpenRouter) streams response metadata across several partial events. A later event that omits a field no longer erases the value an earlier event supplied, so `onStepFinish`, `onFinish` and `result.response` keep the provider's response id. Durable and evented agents now also report the provider's response id, model id and timestamp in `onStepFinish` and `onFinish`.
