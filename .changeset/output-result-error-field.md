---
'@mastra/core': minor
---

Added an optional `error` field to `OutputResult`, the `result` argument of `processOutputResult`. It holds the error that ended the run when `finishReason` is `'error'` and the error is known. A processor can use it to tell a run that hit its `modelSettings.timeout.totalMs` deadline (a `MastraTimeoutError` with `timeoutType: 'total'`) apart from a provider failure.

```ts
import { isMastraTimeoutError } from '@mastra/core/loop';
import type { Processor } from '@mastra/core/processors';

const processor: Processor = {
  id: 'deadline-aware',
  async processOutputResult({ messages, result }) {
    if (isMastraTimeoutError(result.error) && result.error.timeoutType === 'total') {
      // The run ran out of time rather than failing
    }
    return messages;
  },
};
```
