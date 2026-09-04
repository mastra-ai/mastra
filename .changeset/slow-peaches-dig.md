---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
---

Added `Agent.listRuns()` for listing current running and suspended runs with shared filters and pagination. All status selections use last-update ordering with a run ID tie-breaker before pagination. Suspended snapshots are read in batches rather than loading all full execution snapshots at once; calculating totals still scans matching candidates.

```typescript
const { runs } = await agent.listRuns({ status: 'running' });
```
