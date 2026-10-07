---
'@mastra/server': patch
---

The approve and decline tool-call endpoints now keep `providerOptions` and `modelSettings` from the request body and pass them to the agent continuation. Previously these fields were dropped, so options such as reasoning effort were lost after a tool approval.
