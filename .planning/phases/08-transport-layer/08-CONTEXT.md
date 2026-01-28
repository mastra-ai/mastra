# Phase 8: Transport Layer - Discussion Context

**Phase Goal:** WebSocket server endpoint relays screencast frames to connected Studio clients
**Discussed:** 2026-01-27
**Areas Covered:** Route design, Message protocol, Connection lifecycle, Error handling

## Decisions

### Route Design

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL pattern | `/browser/:agentId/stream` | Simple agent-scoped route. Assumes one browser per agent. |
| Authentication | Match Mastra server style | Use same `MastraAuthConfig` pattern with token from `Authorization: Bearer` header or `?apiKey` query param |

### Message Protocol

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frame format | Binary frames only | Send raw base64 as binary. Minimal overhead. Client decodes directly. |
| Status messages | Core states only | connected, browser_starting, streaming, browser_closed. Minimal set. |

**Protocol:**
- Binary messages = screencast frames (base64 encoded JPEG)
- Text messages = JSON status messages: `{ "status": "connected" | "browser_starting" | "streaming" | "browser_closed" }`

### Connection Lifecycle

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Screencast start | On first viewer connect | Start capture when first client connects. Stop when last disconnects. |
| Multiple viewers | Broadcast to all | Single screencast stream, frames sent to all connected clients. |
| No browser active | Hold connection, notify on start | Keep WS open, send status messages. Stream frames when browser starts. |

**Viewer Count Management:**
- Track connected viewers per agentId
- Start screencast when viewer count goes from 0 → 1
- Stop screencast when viewer count goes from 1 → 0
- Broadcast frames to all connected viewers

### Error Handling

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Connection errors | Send error message then close | Notify client of error type, then close cleanly. Client can reconnect. |

**Error message format:**
```json
{ "error": "browser_crashed" | "screencast_failed" | "auth_failed", "message": "Human readable description" }
```

## Implementation Notes

### Mastra Server Auth Pattern

From codebase exploration, Mastra server uses:

```typescript
type MastraAuthConfig<TUser = unknown> = {
  protected?: (RegExp | string | [string, Methods | Methods[]])[];
  public?: (RegExp | string | [string, Methods | Methods[]])[];
  authenticateToken?: (token: string, request: HonoRequest) => Promise<TUser>;
  authorize?: (path: string, method: string, user: TUser, context: ContextWithMastra) => Promise<boolean>;
};
```

Token extraction order:
1. `Authorization: Bearer <token>` header
2. `?apiKey=<token>` query parameter

For WebSocket upgrade, auth happens before connection is established.

### State Machine

```
                    ┌──────────────┐
                    │   closed     │
                    └──────┬───────┘
                           │ connect
                           ▼
                    ┌──────────────┐
                    │  connected   │──────────────┐
                    └──────┬───────┘              │
                           │ browser starts       │ browser never starts
                           ▼                      │ (stays connected, waiting)
                    ┌──────────────┐              │
                    │browser_starting│            │
                    └──────┬───────┘              │
                           │ screencast begins    │
                           ▼                      │
                    ┌──────────────┐              │
                    │  streaming   │◄─────────────┘
                    └──────┬───────┘     browser starts later
                           │ browser closes
                           ▼
                    ┌──────────────┐
                    │browser_closed│─────────┐
                    └──────────────┘         │ browser restarts
                           ▲                 │
                           │                 ▼
                           │          back to browser_starting
```

### Viewer Tracking Data Structure

```typescript
// Map of agentId → Set of WebSocket connections
const viewers = new Map<string, Set<WebSocket>>();

// Active screencast streams per agent
const screencasts = new Map<string, ScreencastStream>();
```

## Requirements Coverage

| Requirement | Covered By |
|-------------|------------|
| XPORT-01: WebSocket endpoint at `/browser/:agentId/stream` | Route design decision |
| XPORT-02: WebSocket handler relays CDP frames | Binary frame protocol |
| XPORT-03: Connections cleaned up on disconnect | Viewer count management |
| XPORT-04: Screencast only runs when viewers connected | First viewer start / last viewer stop |

## Open Questions

None - all gray areas resolved.

## Next Steps

Ready for `/gsd:plan-phase 8` to create execution plans.

---
*Context captured: 2026-01-27*
