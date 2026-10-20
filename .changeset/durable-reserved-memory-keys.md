---
'@mastra/core': patch
---

Fixed DurableAgent ignoring the reserved `mastra__threadId` and `mastra__resourceId` request-context keys. Durable and evented agents now route memory to the thread and resource set on the request context, as the regular Agent does, instead of to the thread or resource named in the call's `memory` options.
