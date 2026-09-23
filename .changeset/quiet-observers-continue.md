---
'@mastra/memory': patch
---

You can now control observational memory retries and choose whether a failed Observer or Reflector stops the agent turn.

- `maxRetries` sets how many times a failed Observer or Reflector call is retried. The default is `8`.
- `failurePolicy: 'continue'` lets the agent turn finish when observation or reflection still fails after all retries. The default, `'abort'`, keeps the current behavior.
- Messages that were not observed are retried on a later turn.
- A cancelled turn always stops, whatever the policy.

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
