---
'@mastra/core': patch
'@mastra/memory': patch
---

Added experimental `workingMemory.useStateSignals` opt-in. When set to `true`, working memory is delivered to the model as a `state` signal (via the new state-signals API) instead of being folded into the system message. `Memory` auto-attaches a `WorkingMemoryStateProcessor` that emits a signal with `stateId: 'working-memory'` and dedups via `cacheKey`. Subsequent turns emit unified-diff deltas against the prior snapshot when the diff is smaller than the snapshot (markdown mode only); schema mode and the fallback path always emit a full snapshot. The working-memory tool is registered as `setWorkingMemory` instead of `updateWorkingMemory` under this opt-in so legacy persistence/prompt strip filters naturally bypass it. The default (`false`) preserves the existing system-message behavior. `useStateSignals` is not supported with template working memory `version: 'vnext'`.

```ts
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
      useStateSignals: true,
    },
  },
});
```
