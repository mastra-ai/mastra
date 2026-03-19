---
'@mastra/core': patch
---

Fixed deserializeRequestContext to return an actual RequestContext instance instead of a Map, preventing crashes during Inngest durable execution replay with observability enabled.
