# Phase 8: Transport Layer - Research

**Researched:** 2026-01-27
**Domain:** WebSocket server integration for screencast frame streaming
**Confidence:** HIGH

## Summary

This phase implements a WebSocket endpoint that relays CDP screencast frames from the BrowserToolset to connected Studio clients. The research confirms that Hono WebSocket support for Node.js is available via `@hono/node-ws` package, but requires specific integration patterns that differ from standard HTTP routes.

The key challenge is that WebSocket support in Hono/Node.js requires initialization at server creation time (not route registration time), meaning the deployer's `createNodeServer` function needs modification. The BrowserToolset already exposes `startScreencast()` which returns a ScreencastStream with event emitter interface - this maps cleanly to WebSocket frame broadcasting.

**Primary recommendation:** Add WebSocket support to Mastra's deployer package using `@hono/node-ws`, create a viewer tracking system per agentId, and relay frames from ScreencastStream events to all connected WebSocket clients.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @hono/node-ws | ^1.3.0 | WebSocket adapter for Hono on Node.js | Official Hono middleware, actively maintained |
| ws | (transitive) | Underlying WebSocket implementation | Industry standard, used by node-ws internally |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mastra/agent-browser | workspace | ScreencastStream API | Frame source for WebSocket relay |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @hono/node-ws | ws directly | More control, but loses Hono integration and type safety |
| WebSocket | Server-Sent Events | SSE is simpler but doesn't support bidirectional (needed for input relay phase) |

**Installation:**
```bash
pnpm add @hono/node-ws
```

## Architecture Patterns

### Recommended Module Structure
```
packages/deployer/src/server/
├── index.ts               # Modify: add WebSocket initialization
├── browser-stream/
│   ├── index.ts           # WebSocket route setup
│   ├── viewer-registry.ts # Map<agentId, Set<WebSocket>>
│   └── types.ts           # Message type definitions
```

### Pattern 1: WebSocket Initialization at Server Level
**What:** WebSocket support must be initialized when creating the Hono app, not when registering routes
**When to use:** Always for Hono + Node.js WebSocket
**Example:**
```typescript
// Source: https://hono.dev/docs/helpers/websocket
import { createNodeWebSocket } from '@hono/node-ws';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Register WebSocket route
app.get('/browser/:agentId/stream', upgradeWebSocket((c) => ({
  onOpen(event, ws) { /* ... */ },
  onMessage(event, ws) { /* ... */ },
  onClose(event, ws) { /* ... */ },
  onError(event, ws) { /* ... */ },
})));

// MUST call injectWebSocket after serve()
const server = serve(app);
injectWebSocket(server);
```

### Pattern 2: Viewer Registry with Reference Counting
**What:** Track connected viewers per agentId, start/stop screencast based on viewer count
**When to use:** When implementing demand-based resource management
**Example:**
```typescript
// Source: Codebase pattern from CONTEXT.md decisions
interface ViewerRegistry {
  viewers: Map<string, Set<WebSocket>>;
  screencasts: Map<string, ScreencastStream>;

  addViewer(agentId: string, ws: WebSocket): void;
  removeViewer(agentId: string, ws: WebSocket): void;
  getViewerCount(agentId: string): number;
}

// Start screencast when first viewer connects
addViewer(agentId: string, ws: WebSocket) {
  const wasEmpty = !this.viewers.has(agentId) || this.viewers.get(agentId)!.size === 0;

  if (!this.viewers.has(agentId)) {
    this.viewers.set(agentId, new Set());
  }
  this.viewers.get(agentId)!.add(ws);

  if (wasEmpty) {
    this.startScreencastForAgent(agentId);
  }
}

// Stop screencast when last viewer disconnects
removeViewer(agentId: string, ws: WebSocket) {
  const set = this.viewers.get(agentId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      this.stopScreencastForAgent(agentId);
      this.viewers.delete(agentId);
    }
  }
}
```

### Pattern 3: Binary Frame Broadcasting
**What:** Send screencast frames as binary WebSocket messages
**When to use:** For efficient frame delivery
**Example:**
```typescript
// Source: CONTEXT.md decisions - binary for frames, text for status
function broadcastFrame(agentId: string, frameData: string) {
  const viewers = registry.viewers.get(agentId);
  if (!viewers) return;

  // frameData is base64, send as binary
  for (const ws of viewers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(frameData);  // Binary message
    }
  }
}

function broadcastStatus(agentId: string, status: StatusMessage) {
  const viewers = registry.viewers.get(agentId);
  if (!viewers) return;

  const message = JSON.stringify(status);
  for (const ws of viewers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);  // Text message
    }
  }
}
```

### Anti-Patterns to Avoid
- **Creating WebSocket inside route handler:** `createNodeWebSocket` must be called at app initialization, not per-request
- **Not calling injectWebSocket:** Server won't handle WebSocket upgrade requests without this
- **Storing WebSocket in global without cleanup:** Leads to memory leaks when connections close
- **Blocking on screencast start:** Start screencast async, send status messages during initialization

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket upgrade handling | HTTP upgrade parsing | @hono/node-ws upgradeWebSocket | Complex protocol, easy to get wrong |
| WebSocket message framing | Binary/text frame encoding | ws library (via node-ws) | RFC 6455 compliance is tricky |
| Connection heartbeat/keepalive | Custom ping/pong | Let ws handle it | Built-in, well-tested |

**Key insight:** The `ws` library (used by @hono/node-ws) handles all the low-level WebSocket protocol complexity. Don't try to parse frames or manage connections manually.

## Common Pitfalls

### Pitfall 1: WebSocket Route Not Upgrading
**What goes wrong:** GET request returns 404 or doesn't upgrade to WebSocket
**Why it happens:** `injectWebSocket(server)` not called after `serve()`
**How to avoid:** Always call `injectWebSocket` on the returned server instance
**Warning signs:** WebSocket connection attempts get HTTP 404 responses

### Pitfall 2: Memory Leak from Dangling Connections
**What goes wrong:** Server memory grows over time, eventually OOM
**Why it happens:** WebSocket references kept after connection closes
**How to avoid:**
- Always remove from viewer registry in `onClose` handler
- Clear any interval timers associated with the connection
- Remove event listeners from ScreencastStream when last viewer leaves
**Warning signs:** `process.memoryUsage().heapUsed` grows monotonically

### Pitfall 3: CORS Middleware Conflict
**What goes wrong:** WebSocket upgrade fails with "can't modify immutable headers"
**Why it happens:** CORS middleware tries to set headers after upgradeWebSocket
**How to avoid:** WebSocket routes should be registered before CORS middleware, or exclude WebSocket paths from CORS
**Warning signs:** Error message about immutable headers in server logs

### Pitfall 4: Race Condition on First Viewer Connect
**What goes wrong:** First viewer gets no frames or duplicate start calls
**Why it happens:** Multiple viewers connect simultaneously, multiple screencast starts
**How to avoid:** Use synchronous check-and-start pattern, or track "starting" state
**Warning signs:** Multiple "screencast started" logs for same agentId

### Pitfall 5: BrowserToolset Not Found
**What goes wrong:** WebSocket connects but agent has no browser
**Why it happens:** Agent doesn't have BrowserToolset configured, or browser not launched
**How to avoid:** Send status message indicating browser state, handle gracefully
**Warning signs:** Errors about undefined toolset or browser

## Code Examples

### WebSocket Route Registration (Hono + Node.js)
```typescript
// Source: https://hono.dev/docs/helpers/websocket + @hono/node-ws npm
import { createNodeWebSocket } from '@hono/node-ws';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

export function setupBrowserStreamWebSocket(app: Hono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  // Route must be GET for WebSocket upgrade
  app.get('/browser/:agentId/stream', upgradeWebSocket((c) => {
    const agentId = c.req.param('agentId');

    return {
      onOpen(event, ws) {
        // Add to viewer registry
        // Send connected status
        // Start screencast if first viewer
      },

      onMessage(event, ws) {
        // Future: handle input events
      },

      onClose(event, ws) {
        // Remove from viewer registry
        // Stop screencast if last viewer
      },

      onError(event, ws) {
        // Log error, clean up
      },
    };
  }));

  return { injectWebSocket };
}

// In createNodeServer:
const { injectWebSocket } = setupBrowserStreamWebSocket(app);
const server = serve({ fetch: app.fetch, port });
injectWebSocket(server);  // CRITICAL: must be called!
```

### ScreencastStream Integration
```typescript
// Source: integrations/agent-browser/src/screencast/screencast-stream.ts
import type { BrowserToolset, ScreencastStream } from '@mastra/agent-browser';

async function startScreencastForAgent(
  agentId: string,
  toolset: BrowserToolset,
  onFrame: (data: string) => void
) {
  const stream = await toolset.startScreencast({
    format: 'jpeg',
    quality: 70,
    maxWidth: 1280,
    maxHeight: 720,
  });

  stream.on('frame', (frame) => {
    onFrame(frame.data);  // frame.data is base64 string
  });

  stream.on('stop', (reason) => {
    // Handle screencast stop - notify viewers
  });

  return stream;
}
```

### Authentication for WebSocket
```typescript
// Source: CONTEXT.md decisions - match Mastra server auth pattern
function authenticateWebSocket(c: Context): boolean {
  // Check Authorization header
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Validate token...
    return true;
  }

  // Check apiKey query param
  const apiKey = c.req.query('apiKey');
  if (apiKey) {
    // Validate apiKey...
    return true;
  }

  return false;
}

// In upgradeWebSocket handler:
app.get('/browser/:agentId/stream', upgradeWebSocket((c) => {
  if (!authenticateWebSocket(c)) {
    // Return early - connection will be rejected
    return {
      onOpen(event, ws) {
        ws.send(JSON.stringify({ error: 'auth_failed', message: 'Authentication required' }));
        ws.close(1008, 'Authentication required');
      },
    };
  }
  // ... normal handler
}));
```

### Status Message Protocol
```typescript
// Source: CONTEXT.md decisions
type StatusMessage = {
  status: 'connected' | 'browser_starting' | 'streaming' | 'browser_closed';
};

type ErrorMessage = {
  error: 'browser_crashed' | 'screencast_failed' | 'auth_failed';
  message: string;
};

// Usage:
ws.send(JSON.stringify({ status: 'connected' }));     // Text message
ws.send(frameData);                                    // Binary message (base64)
ws.send(JSON.stringify({ status: 'streaming' }));     // Text message
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE for streaming | WebSocket | N/A (new feature) | Enables bidirectional communication for future input relay |
| Per-request browser | Shared BrowserToolset | Phase 1 | Single browser instance per agent |

**Deprecated/outdated:**
- None - this is new functionality

## Open Questions

1. **BrowserToolset Discovery**
   - What we know: Agents have tools, BrowserToolset creates tools, but no direct registry
   - What's unclear: How does WebSocket handler get BrowserToolset instance for an agentId?
   - Recommendation: Either (a) add BrowserToolset to agent metadata, or (b) maintain separate toolset registry in deployer, or (c) create new BrowserToolset per stream request (loses state with agent's browser). Suggest option (b) for this phase.

2. **Error Recovery**
   - What we know: ScreencastStream emits 'error' and 'stop' events
   - What's unclear: Should viewers be notified and disconnected on screencast error, or attempt reconnect?
   - Recommendation: Notify via error message, let client decide to reconnect. Don't auto-close WebSocket.

3. **Multiple Agents Same Browser**
   - What we know: Current design assumes one BrowserToolset per agent
   - What's unclear: If multiple agents share a BrowserToolset, how does agentId routing work?
   - Recommendation: Out of scope for Phase 8. Assume 1:1 agent:BrowserToolset mapping.

## Sources

### Primary (HIGH confidence)
- [Hono WebSocket Helper](https://hono.dev/docs/helpers/websocket) - Official documentation for WebSocket in Hono
- [@hono/node-ws npm](https://www.npmjs.com/package/@hono/node-ws) - Node.js WebSocket adapter (v1.3.0)
- `/integrations/agent-browser/src/screencast/` - ScreencastStream implementation from Phase 7
- `/packages/deployer/src/server/index.ts` - Current server setup, uses @hono/node-server

### Secondary (MEDIUM confidence)
- `/packages/server/src/server/handlers/agents.ts` - `getAgentFromSystem` pattern for agent lookup
- [WebSocket memory leak prevention](https://github.com/websockets/ws/issues/804) - ws library memory management

### Tertiary (LOW confidence)
- General WebSocket broadcast patterns from web search

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified via official Hono docs and npm
- Architecture: HIGH - Based on existing Mastra patterns and CONTEXT.md decisions
- Pitfalls: MEDIUM - Mix of documented issues and inferred from architecture

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (stable domain, 30-day validity)
