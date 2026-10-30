---
'@mastra/core': minor
---

Added an optional `inputAccepted` field to `OutputResult`, the `result` argument of `processOutputResult`. It is set only when `finishReason` is `'error'`, and is `true` when the run accepted the turn's input before it failed. `MessageHistory` uses it to keep the user message of a failed turn that produced no output, so an accepted turn is not lost from history. Failed turns without the flag are still dropped, as before.

```ts
import type { Processor } from '@mastra/core/processors';

const processor: Processor = {
  id: 'accepted-turns',
  async processOutputResult({ messages, result }) {
    if (result.finishReason === 'error' && result.inputAccepted) {
      // The run failed after accepting this turn's input
    }
    return messages;
  },
};
```
