---
'@mastra/core': patch
---

Improved A2A v0.3 remote task continuation. A2AAgent now resumes input and authentication requests using the original task ID and surfaces protocol errors returned by remote agents.

```typescript
const resumedResult = await remoteAgent.resumeGenerate({ approved: true }, { runId });
console.log(resumedResult.text);
```
