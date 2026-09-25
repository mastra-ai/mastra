---
'@mastra/core': minor
---

Added `maxRetries` and `failurePolicy` options to the observational memory `observation` and `reflection` settings. When `failurePolicy` is `'continue'`, an Observer or Reflector model failure no longer ends the agent turn.

```ts
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    observationalMemory: {
      observation: { maxRetries: 2, failurePolicy: 'continue' },
      reflection: { maxRetries: 2, failurePolicy: 'continue' },
    },
  },
});
```
