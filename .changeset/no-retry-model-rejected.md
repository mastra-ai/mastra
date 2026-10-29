---
'@mastra/core': patch
---

Retry policies that match bad-request errors no longer retry a 400 that rejects the model or a parameter, such as `model_not_found`. These requests fail the same way on every retry.
