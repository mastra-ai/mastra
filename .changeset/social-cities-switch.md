---
'@mastra/core': minor
---

Added `outputOptions` to `run.restart()`, matching `run.start()` and `run.resume()`. Set `includeState: true` to get the final workflow state in the result.

```typescript
const result = await run.restart({ outputOptions: { includeState: true } });
console.log(result.state);
```
