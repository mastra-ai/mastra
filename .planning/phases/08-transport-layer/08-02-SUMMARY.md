---
phase: 08-transport-layer
plan: 02
status: complete
started: 2026-01-27T16:30:00Z
completed: 2026-01-27T16:35:00Z
duration: 5 min
---

# Plan 08-02 Summary: Server Integration

## Objective

Integrate WebSocket browser stream into the deployer server, completing the transport layer.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend ServerBundleOptions with browserToolsets registry | `77f1084c77` | types.ts |
| 2 | Integrate browser-stream WebSocket into server setup | `ffd9d799bc` | index.ts, browser-stream.ts |

## Deliverables

### ServerBundleOptions Extension

Extended `ServerBundleOptions` in `packages/deployer/src/server/types.ts` with optional `browserToolsets` map:

```typescript
export type ServerBundleOptions = {
  studio?: boolean;
  isDev?: boolean;
  tools: Record<string, Tool>;
  browserToolsets?: Map<string, BrowserToolset>;
};
```

This allows agents to register their BrowserToolset instances for WebSocket frame streaming.

### Server Integration

Modified `packages/deployer/src/server/index.ts`:

1. **Import**: Added `setupBrowserStream` import from browser-stream module

2. **Setup Before CORS**: Called `setupBrowserStream` BEFORE CORS middleware to avoid "immutable headers" error:
```typescript
const browserStreamSetup = setupBrowserStream(app, {
  getToolset: (agentId: string) => options.browserToolsets?.get(agentId),
});
```

3. **Return Type Change**: `createHonoServer` now returns `{ app, injectWebSocket }` instead of just `app`

4. **WebSocket Injection**: `createNodeServer` calls `injectWebSocket(server)` AFTER `serve()` returns

## Verification

- Package builds successfully with `pnpm build:lib`
- setupBrowserStream called before CORS middleware
- injectWebSocket called after serve() returns
- browserToolsets option available in ServerBundleOptions
- All key links verified:
  - setupBrowserStream import and call in index.ts
  - injectWebSocket(server) call after serve()

## Requirements Satisfied

- **XPORT-01**: WebSocket endpoint exists at `/browser/:agentId/stream` (via 08-01)
- **XPORT-02**: WebSocket handler relays CDP frames (via ViewerRegistry.broadcastFrame)
- **XPORT-03**: Connections cleaned up in onClose/onError handlers
- **XPORT-04**: Screencast lifecycle managed by ViewerRegistry reference counting

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Optional browserToolsets | Supports dynamic agent creation; connections work but don't stream until toolset registered |
| Setup before CORS | Required to avoid WebSocket upgrade header conflicts |
| injectWebSocket after serve() | Required by @hono/node-ws architecture |

## Issues Encountered

None.

---
*Completed: 2026-01-27*
