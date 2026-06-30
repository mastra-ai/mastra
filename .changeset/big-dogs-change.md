---
'@mastra/core': minor
'mastracode': patch
---

Renamed the AgentController interval API. `heartbeatHandlers` is now `intervalHandlers`, the `HeartbeatHandler` type is now `IntervalHandler`, and the `removeHeartbeat()`/`stopHeartbeats()` methods are now `removeInterval()`/`stopIntervals()`. This better reflects that these are fixed-interval background tasks, not liveness pings, and is distinct from the unrelated `mastra.heartbeats` scheduled-agent feature.

**Before**

```ts
const { controller } = await createMastraCode({
  heartbeatHandlers: [{ id: 'sync', intervalMs: 60_000, handler: async () => {} }],
});
await controller.removeHeartbeat({ id: 'sync' });
await controller.stopHeartbeats();
```

**After**

```ts
const { controller } = await createMastraCode({
  intervalHandlers: [{ id: 'sync', intervalMs: 60_000, handler: async () => {} }],
});
await controller.removeInterval({ id: 'sync' });
await controller.stopIntervals();
```
