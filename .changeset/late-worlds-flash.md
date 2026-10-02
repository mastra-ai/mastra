---
'@mastra/core': patch
---

Fixed durable threads that reported suspended tool calls as lost after a restart. Pending tool calls remain available for a response.
