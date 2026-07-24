---
'@mastra/core': patch
---

Fixed processors to receive their owning agent during signal, schedule, standard, and durable execution.

```ts
import type { InputProcessor } from '@mastra/core/processors';

const processor: InputProcessor = {
  id: 'memory-aware-processor',
  processInput: async ({ agent, messages, requestContext }) => {
    await agent?.getMemory({ requestContext });
    return messages;
  },
};
```
