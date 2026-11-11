---
'@mastra/server-adapters-test-suite': patch
---

Added shared tests for server adapters. They check that when a client disconnects, a custom route's agent run stops, even after garbage collection, and that a custom route's request is freed once its streamed response ends or fails.

```ts
import { createCustomRouteDisconnectTestSuite } from '@mastra/server-adapters-test-suite';

createCustomRouteDisconnectTestSuite({
  suiteName: 'My adapter: custom route disconnect',
  startServer: async mastra => {
    const { baseUrl, close } = await serveMyAdapter(mastra);
    return { baseUrl, close };
  },
});
```
