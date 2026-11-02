---
'@mastra/core': patch
---

Fixed durable agents (`durable: true`) ending the `model_generation` trace span without `responseId` and `responseModel`. Durable runs now record the provider's response id and model on the span, the same as non-durable agents, so a trace can be linked back to the provider's own response log. Fixes #29053.
