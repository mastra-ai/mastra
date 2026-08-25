---
'@mastra/client-js': minor
---

Added a platform-neutral thread-signals client for browsers and React Native. It subscribes to native thread runs, exposes run snapshots, reconnects, and provides message, queue, approval, abort, and history operations without web UI or Node-only runtime dependencies.

```ts
import { createThreadSignalsClient } from '@mastra/client-js/thread-signals';

const client = createThreadSignalsClient({
  baseUrl: 'https://example.com',
  agentId: 'supportAgent',
});
const subscription = await client.subscribeToThread({
  resourceId: 'user-1',
  threadId: 'thread-1',
});

await subscription.processDataStream({
  onChunk: chunk => console.log(chunk),
  reconnect: true,
});
```
