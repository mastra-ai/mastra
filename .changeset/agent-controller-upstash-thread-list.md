---
'@mastra/upstash': patch
---

Mark thread listing as in-memory paginated so limited controller queries scan and sort the resource once instead of repeating full reads.
