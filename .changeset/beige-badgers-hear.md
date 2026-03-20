---
'@mastra/core': minor
---

Added `processAPIError` method to the Processor interface, enabling processors to intercept and handle LLM API rejection errors (e.g., 400/422 status codes) before they surface as final errors. This allows processors to inspect the error, modify the request (such as appending messages), and signal a retry.

**New built-in processor: `PrefillErrorHandler`**

Automatically handles the Anthropic "assistant message prefill" error by appending a `<continue>` user message and retrying. This processor is auto-injected — no configuration needed.

**New types:** `ProcessAPIErrorArgs`, `ProcessAPIErrorResult`, `ErrorProcessor`

```ts
import { Processor, ProcessAPIErrorArgs, ProcessAPIErrorResult } from '@mastra/core/processors';

const myErrorHandler: Processor = {
  id: 'my-error-handler',
  processAPIError({ error, messageList, retryCount }: ProcessAPIErrorArgs): ProcessAPIErrorResult | void {
    if (retryCount > 0) return; // only retry once
    if (isMySpecificError(error)) {
      // Modify messages and signal retry
      return { retry: true, feedback: 'Retrying with modified request' };
    }
  },
};
```
