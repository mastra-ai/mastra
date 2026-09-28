---
'@mastra/core': patch
---

Fixed Anthropic extended-thinking threads with working memory getting stuck on every turn with "thinking blocks in the latest assistant message cannot be modified". When the model spent a step only on an `updateWorkingMemory` call, the saved history kept that step's thinking without its tool call, so later requests replayed it merged into the next step. That step is now dropped when the call is hidden.

Threads already saved in this state recover when `ProviderHistoryCompat` is in the agent's error processors: on that Anthropic error it drops the leftover thinking step and retries once.

```ts
import { Agent } from '@mastra/core/agent';
import { ProviderHistoryCompat } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  errorProcessors: [new ProviderHistoryCompat()],
});
```

Fixes [#22798](https://github.com/mastra-ai/mastra/issues/22798).
