---
'@mastra/server-adapters-test-suite': minor
---

Added `createStreamDisconnectTestSuite`, which checks over real HTTP that an adapter stops reading a route's stream when the client disconnects and pauses reading while the client is not reading.

```ts
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';

createStreamDisconnectTestSuite({
  // Serve `route` with your adapter and return its URL. Run `beforeContext` before the adapter's context middleware.
  startServer: async (route, { beforeContext } = {}) => {
    const { url, close } = await startMyAdapterServer(route, beforeContext);
    return { url, close };
  },
});
```
