---
'@mastra/core': patch
---

`isBadRequestError` no longer matches a 400 that rejects the model (for example `model_not_found` or "model is not supported"), so `StreamErrorRetryProcessor` stops resending a request that will fail the same way.
