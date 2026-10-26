---
'@mastra/core': patch
---

`JsonReadyAgentControllerEvent` now types a flattened error with the optional `statusCode`, `responseBody` and `requestId` that a saved error part keeps, so clients can read them from a live event without a cast.
