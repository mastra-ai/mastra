---
'@mastra/core': minor
---

Added `observedUsage` to agent results, so you can read the token counts that were reported when `totalUsage` is unknown, for example after a retry recovers a failed call. `incomplete` is `true` when `totalUsage` has an unknown count, so the run may have cost more than this sum.

```ts
const { observedUsage } = await agent.generate('Where is my order?');
console.log(observedUsage.inputTokens, observedUsage.outputTokens, observedUsage.incomplete);
```
