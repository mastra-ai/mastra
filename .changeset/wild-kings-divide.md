---
'@mastra/server-adapters-test-suite': patch
---

Added shared HTTP conformance tests for server adapters. They check that a client disconnect stops a custom route's agent run even after garbage collection, and that a custom route's request is released once its streamed response ends or fails.

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
