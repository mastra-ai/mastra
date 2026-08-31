---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
---

Added `Agent.listRuns()` for listing current running and suspended runs with shared filters and pagination.

```typescript
const { runs } = await agent.listRuns({ status: 'running' });
```
