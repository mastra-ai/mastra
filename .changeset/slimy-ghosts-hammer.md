---
'@mastra/inngest': minor
---

Updated `@mastra/inngest` to use Inngest SDK v4.

**Breaking:** Requires `inngest@^4` and Inngest Dev Server `v1.18.0` or later. The `@inngest/realtime` package is no longer needed — its functionality is now included in `inngest` v4. Remove it from your dependencies and import realtime helpers from `inngest/realtime` instead.

```diff
  // package.json
  "dependencies": {
-   "@inngest/realtime": "^0.x",
-   "inngest": "^3.x"
+   "inngest": "^4.0.0"
  }
```

```diff
- import { realtimeMiddleware } from '@inngest/realtime/middleware';
- import { subscribe } from '@inngest/realtime';
+ import { subscribe } from 'inngest/realtime';

  const inngest = new Inngest({
    id: 'mastra',
-   middleware: [realtimeMiddleware()],
  });
```

In v4, `subscribe()` and `realtime.publish()` are first-class methods on the client; the standalone middleware is no longer required. `InngestPubSub` publishes via `inngest.realtime.publish()` instead of the function-context `publish` argument that no longer exists in v4, restoring realtime workflow events and agent stream events.

**Improved:** Workflow result polling now uses snapshot-based polling, resulting in significantly faster retrieval (~83x).
