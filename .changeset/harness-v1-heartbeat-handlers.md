---
'@mastra/core': minor
---

Added heartbeat handler support to Harness v1, so background tasks can run on intervals and stop automatically with the harness lifecycle. Configured handlers start when `harness.init()` runs, duplicate configured ids are rejected, and registering a runtime handler with an existing `id` replaces the previous handler.

**Example:**

```typescript
const harness = new Harness({
  // ...existing Harness v1 config
  heartbeatHandlers: [
    {
      id: 'sync-gateway',
      intervalMs: 30_000,
      handler: async () => {
        await syncGatewayState();
      },
      immediate: true,
      shutdown: async () => {
        await closeGatewaySync();
      },
    },
  ],
});
```
