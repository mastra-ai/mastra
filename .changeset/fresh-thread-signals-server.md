---
'@mastra/server': minor
---

Thread subscriptions now emit an initial transient `data-thread-state` chunk so refreshed and secondary clients immediately receive the thread's running, suspended, or idle state.

```ts
import { createThreadSignalsClient } from '@mastra/client-js/thread-signals';

const subscription = await createThreadSignalsClient({
  baseUrl: 'https://example.com',
  agentId: 'supportAgent',
}).subscribeToThread({ threadId: 'thread-1' });

await subscription.processDataStream({
  onChunk: () => {},
  onSnapshot: ({ status }) => {
    if (status === 'running' || status === 'suspended' || status === 'idle') {
      // Render the initial transient state.
    }
  },
});
```
