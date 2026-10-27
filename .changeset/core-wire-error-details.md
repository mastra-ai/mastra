---
'@mastra/core': patch
---

A saved error part of a failed provider call now keeps `modelId`, the model the request named, so a reloaded thread can say which model failed. Only the model name is read from the request; the prompt and the rest of the request body are still never saved.

`JsonReadyAgentControllerEvent` now types a flattened error with the optional `statusCode`, `responseBody`, `requestId` and `modelId` that a saved error part keeps, so clients can read them from a live event without a cast.
