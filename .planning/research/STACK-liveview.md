# Technology Stack: Browser Live View

**Project:** Mastra Browser Tools v1.1 - Live Screencast Streaming
**Researched:** 2026-01-27

## Executive Summary

The `agent-browser` library (v0.8.0) already provides a complete screencast API via Chrome DevTools Protocol (CDP). The stack decision centers on **transport** (how to get frames from server to Studio) and **rendering** (how to display them). No new browser automation dependencies are needed.

**Key Insight:** agent-browser's `BrowserManager.startScreencast()` streams JPEG frames via callback. The work is connecting this to Studio's React frontend.

## Recommended Stack

### Core (Already Available - No Changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| agent-browser | ^0.8.0 | Screencast source | Already integrated; provides `startScreencast()`, `stopScreencast()`, `injectMouseEvent()`, `injectKeyboardEvent()` |
| playwright-core | ^1.57.0 | CDP communication | Transitive dep of agent-browser; handles Chrome DevTools Protocol |
| @mastra/core | workspace | Toolset framework | BrowserToolset already wraps agent-browser |

### Transport Layer (NEW - Add to @mastra/server)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **WebSocket (ws)** | ^8.19.0 | Frame streaming | Binary-capable, bidirectional for input injection, already a dep of agent-browser |

**Rationale for WebSocket over SSE:**
- Screencast frames are base64-encoded JPEG (~50-200KB per frame at 1-5 FPS)
- SSE is text-only; would require encoding overhead
- WebSocket supports bidirectional communication for input injection (mouse/keyboard)
- agent-browser already includes `ws` library and provides `StreamServer` class as reference implementation
- WebSocket has lower per-frame overhead after connection (~2 bytes vs ~5 bytes for SSE)

### Frontend Rendering (NEW - Add to @mastra/playground-ui)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `<img>` tag | N/A | Frame display | Simplest approach; update `src` with data URL on each frame |
| React state | N/A | Frame buffer | Store latest frame data URL in state, render via img |

**NOT Recommended:**
- `<canvas>` - Adds complexity, no benefit for static frame display
- `<video>` - Not a video stream, discrete JPEG frames
- WebRTC - Overkill for 1-5 FPS screencast

## agent-browser Screencast API

### BrowserManager.startScreencast()

```typescript
// Start streaming frames
await browserManager.startScreencast(
  (frame: ScreencastFrame) => {
    // frame.data is base64-encoded JPEG/PNG
    // frame.metadata contains viewport info
    console.log('Frame:', frame.metadata.deviceWidth, 'x', frame.metadata.deviceHeight);
  },
  {
    format: 'jpeg',      // 'jpeg' or 'png'
    quality: 80,         // 0-100 for jpeg
    maxWidth: 1280,      // max frame width
    maxHeight: 720,      // max frame height
    everyNthFrame: 1,    // skip frames for performance
  }
);

// Stop streaming
await browserManager.stopScreencast();

// Check status
browserManager.isScreencasting(); // boolean
```

### ScreencastFrame Type

```typescript
interface ScreencastFrame {
  data: string;  // base64-encoded image
  metadata: {
    offsetTop: number;
    pageScaleFactor: number;
    deviceWidth: number;
    deviceHeight: number;
    scrollOffsetX: number;
    scrollOffsetY: number;
    timestamp?: number;
  };
  sessionId: number;
}
```

### Input Injection (for future interactive mode)

```typescript
// Mouse events
await browserManager.injectMouseEvent({
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel',
  x: number,
  y: number,
  button?: 'left' | 'right' | 'middle' | 'none',
  clickCount?: number,
  deltaX?: number,  // for wheel
  deltaY?: number,
  modifiers?: number,
});

// Keyboard events
await browserManager.injectKeyboardEvent({
  type: 'keyDown' | 'keyUp' | 'char',
  key?: string,
  code?: string,
  text?: string,
  modifiers?: number,
});
```

## Integration Points

### Server Side (@mastra/server or @mastra/agent-browser)

agent-browser includes a reference `StreamServer` class that demonstrates the WebSocket pattern:

```typescript
// From agent-browser/dist/stream-server.d.ts
class StreamServer {
  constructor(browser: BrowserManager, port?: number);
  start(): Promise<void>;
  stop(): Promise<void>;
  getPort(): number;
  getClientCount(): number;
}
```

**Two possible approaches:**

1. **Extend BrowserToolset** (simpler): Add `startLiveView()` method that starts WebSocket server
2. **Add to @mastra/server** (cleaner): Create WebSocket route alongside existing HTTP routes

### Client Side (@mastra/playground-ui)

Mastra Studio uses:
- React 19 with hooks
- TanStack Query for server state
- Zustand for client state
- SSE for agent response streaming (existing pattern)

**Recommended approach:** Create a `useBrowserLiveView` hook that:
1. Opens WebSocket connection to screencast endpoint
2. Updates state with each frame
3. Returns current frame for rendering
4. Handles connection lifecycle

### WebSocket Protocol

Follow agent-browser's established protocol:

**Server -> Client (frames):**
```json
{
  "type": "frame",
  "data": "<base64-encoded-jpeg>",
  "metadata": {
    "deviceWidth": 1280,
    "deviceHeight": 720,
    "pageScaleFactor": 1,
    "offsetTop": 0,
    "scrollOffsetX": 0,
    "scrollOffsetY": 0
  }
}
```

**Server -> Client (status):**
```json
{
  "type": "status",
  "connected": true,
  "screencasting": true,
  "viewportWidth": 1280,
  "viewportHeight": 720
}
```

**Client -> Server (future - input injection):**
```json
{
  "type": "input_mouse",
  "eventType": "mousePressed",
  "x": 100,
  "y": 200,
  "button": "left",
  "clickCount": 1
}
```

## What NOT to Add

| Technology | Why NOT |
|------------|---------|
| Socket.IO | Overkill; plain WebSocket is sufficient and already used by agent-browser |
| WebRTC | Designed for peer-to-peer video; we have server-to-client JPEG frames |
| Canvas rendering | img tag is simpler and sufficient for static frames |
| Additional CDP library | agent-browser already handles this via playwright-core |
| Image compression library | CDP already returns JPEG at configurable quality |
| Polling-based approach | Inefficient for real-time streaming |

## Performance Considerations

### Frame Rate and Quality Tradeoffs

| Setting | Value | Use Case |
|---------|-------|----------|
| everyNthFrame: 1 | ~10-30 FPS | Smooth viewing, higher bandwidth |
| everyNthFrame: 3 | ~3-10 FPS | Balanced for most use cases |
| everyNthFrame: 6 | ~1-5 FPS | Low bandwidth, adequate for monitoring |
| quality: 80 | ~50-150KB/frame | Good balance of quality and size |
| quality: 50 | ~20-50KB/frame | Lower bandwidth, acceptable quality |
| maxWidth: 1280 | HD resolution | Standard laptop viewport |
| maxWidth: 800 | Reduced resolution | Thumbnail/preview mode |

### Recommended Defaults

```typescript
const SCREENCAST_DEFAULTS = {
  format: 'jpeg' as const,
  quality: 70,          // Balance quality vs bandwidth
  maxWidth: 1280,       // Standard HD
  maxHeight: 720,       // 16:9 aspect ratio
  everyNthFrame: 2,     // ~5-15 FPS depending on page activity
};
```

## Existing Patterns to Follow

### Mastra Server Streaming (SSE)

```typescript
// From packages/server/src/server/handlers/agents.ts
export const STREAM_GENERATE_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  // ...
});
```

For WebSocket, Mastra server uses Hono which supports WebSocket upgrade.

### BrowserToolset Pattern

```typescript
// From integrations/agent-browser/src/toolset.ts
export class BrowserToolset {
  private browserManager: BrowserManager | null = null;
  private launchPromise: Promise<BrowserManager> | null = null;

  private async getBrowser(): Promise<BrowserManager> {
    // Singleton promise pattern - reuse for screencast
  }
}
```

Screencast methods should be added to `BrowserToolset` to maintain the same lifecycle management.

## Implementation Options

### Option A: BrowserToolset Extension (Recommended for v1.1)

Add screencast methods directly to `BrowserToolset`:

```typescript
// integrations/agent-browser/src/toolset.ts
export class BrowserToolset {
  // ... existing code ...

  /**
   * Start live view streaming via WebSocket
   * Returns the WebSocket server port for client connection
   */
  async startLiveView(options?: ScreencastOptions): Promise<{ port: number }> {
    const browser = await this.getBrowser();
    // Start StreamServer with browser instance
  }

  async stopLiveView(): Promise<void> {
    // Stop StreamServer
  }

  isLiveViewActive(): boolean {
    // Check StreamServer status
  }
}
```

**Pros:**
- Simple, self-contained
- Reuses existing singleton browser pattern
- No changes needed to @mastra/server

**Cons:**
- Separate WebSocket port from main Mastra server
- Each BrowserToolset instance manages own WebSocket server

### Option B: Mastra Server Integration (Future consideration)

Add WebSocket route to @mastra/server that proxies to BrowserToolset screencast.

**Pros:**
- Single port for all Mastra services
- Better integration with existing auth/routing

**Cons:**
- More infrastructure changes
- Needs way to associate WebSocket connection with specific BrowserToolset instance

## Sources

- agent-browser README: `/node_modules/.pnpm/agent-browser@0.8.0/node_modules/agent-browser/README.md`
- agent-browser browser.d.ts: Type definitions for BrowserManager screencast API
- agent-browser stream-server.d.ts: Reference WebSocket implementation
- [WebSocket vs SSE comparison](https://softwaremill.com/sse-vs-websockets-comparing-real-time-communication-protocols/) - SSE text-only limitation
- [Real-time protocol comparison 2025](https://potapov.me/en/make/websocket-sse-longpolling-realtime/) - WebSocket for binary data

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| agent-browser Screencast API | HIGH | Verified from actual type definitions and README |
| WebSocket for transport | HIGH | Binary support, bidirectional, already in dep tree |
| Frontend rendering (img tag) | HIGH | Standard pattern, simplest solution |
| Performance defaults | MEDIUM | Reasonable estimates, will need tuning |
| BrowserToolset integration | MEDIUM | Clear patterns exist, approach is sound |
| Mastra server integration | LOW | Would need more research on Hono WebSocket patterns |
