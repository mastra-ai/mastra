---
'@mastra/inngest': patch
---

Fixed Inngest durable agents ending the `model_generation` trace span without `responseId` and `responseModel`. The span now carries the provider's response id and model, the same as non-durable agents. Fixes #29053.
