---
'@mastra/client-js': minor
'@mastra/server': patch
'@mastra/core': patch
---

Added `agent.listRuns()` for listing current running and suspended runs through the client SDK.

```typescript
const agent = client.getAgent('my-agent');
const { runs } = await agent.listRuns({ status: 'running' });
```
