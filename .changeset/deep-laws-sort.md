---
'@mastra/core': patch
---

Fixed agent.network() to properly pass requestContext to workflow runs. Workflow execution now includes user metadata (userId, resourceId) for observability and analytics. (Fixes #12330)
