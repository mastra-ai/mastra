---
'@mastra/server': patch
---

Fixed the approve and decline tool call endpoints dropping `providerOptions` and `modelSettings` from the request body. Both fields are now passed through to the agent when a tool call is approved or declined (#26086).
