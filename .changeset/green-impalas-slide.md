---
'@mastra/core': patch
---

Fixed sub-agent memory isolation so sub-agents no longer inherit parent requestContext keys and write to their own threads when `mastra__threadId` or `mastra__resourceId` are set.
