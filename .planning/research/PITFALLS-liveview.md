# Domain Pitfalls: Browser Live View / Screencast Streaming

**Domain:** Browser automation live preview (streaming frames from Playwright/CDP to React frontend)
**Context:** Adding live view feature to existing Mastra agent-browser toolset
**Researched:** 2026-01-27
**Confidence:** MEDIUM (based on CDP documentation, community issues, and established patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, memory exhaustion, or system instability.

### Pitfall 1: Missing CDP Frame Acknowledgment (Backpressure Failure)

**What goes wrong:** The CDP screencast API uses `Page.screencastFrameAck` as a flow control mechanism. Each frame received via `Page.screencastFrame` must be acknowledged with `screencastFrameAck({ sessionId })`. Without acknowledgment, Chrome will either stop sending frames or buffer them indefinitely, eventually causing memory issues in the browser process.

**Why it happens:** Developers familiar with typical event-driven patterns expect "fire and forget" semantics. The CDP documentation marks this as experimental and the ack pattern is easy to overlook.

**Consequences:**
- Screencast stops working after a few frames
- Chrome process memory grows unbounded
- `ProtocolError: Page.screencastFrameAck timed out` errors

**Prevention:**
```typescript
// Always acknowledge frames immediately
cdpSession.on('Page.screencastFrame', async (frame) => {
  // Send ack FIRST, before processing
  await cdpSession.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
  // Then process the frame
  broadcastFrame(frame.data);
});
```

**Detection:** Monitor for `ProtocolError` exceptions or screencast that stops after initial frames.

**Phase to address:** Phase 1 (CDP integration) - core implementation must handle this correctly from the start.

**Sources:**
- [Chrome DevTools Protocol - Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/)
- [Puppeteer screencast discussion](https://www.browserless.io/blog/screencast)

---

### Pitfall 2: Base64 Frame Data Causes React Virtual DOM Thrashing

**What goes wrong:** CDP's `Page.screencastFrame` returns frame data as base64-encoded strings. Storing these in React state and rendering via `<img src={`data:image/jpeg;base64,${frame}`} />` causes the entire base64 string to pass through React's virtual DOM diffing on every frame. At 10+ FPS with ~100KB frames, this creates severe performance degradation.

**Why it happens:** The obvious implementation path (useState + img src) works for low-frequency updates. It's only at streaming frame rates that the problem becomes apparent.

**Consequences:**
- UI becomes unresponsive at higher frame rates
- High CPU usage in the browser tab
- Dropped frames and stuttering
- React DevTools shows constant re-renders

**Prevention:**

Option A: Use `useRef` to bypass React rendering
```tsx
const imgRef = useRef<HTMLImageElement>(null);

useEffect(() => {
  socket.on('frame', (base64Data) => {
    // Direct DOM manipulation - no React re-render
    if (imgRef.current) {
      imgRef.current.src = `data:image/jpeg;base64,${base64Data}`;
    }
  });
}, []);

return <img ref={imgRef} alt="Live browser view" />;
```

Option B: Use Object URLs instead of base64 (requires binary WebSocket)
```tsx
const imgRef = useRef<HTMLImageElement>(null);
const prevUrl = useRef<string | null>(null);

useEffect(() => {
  socket.binaryType = 'arraybuffer';
  socket.on('frame', (buffer: ArrayBuffer) => {
    // Revoke previous URL to prevent memory leak
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);

    const blob = new Blob([buffer], { type: 'image/jpeg' });
    prevUrl.current = URL.createObjectURL(blob);
    if (imgRef.current) imgRef.current.src = prevUrl.current;
  });
}, []);
```

**Detection:** Use React DevTools Profiler to check for frequent re-renders of the frame component. Monitor JS heap size for growth patterns.

**Phase to address:** Phase 2 (React integration) - critical for usable performance.

**Sources:**
- [Object URLs vs Base64 Data URIs comparison](https://www.bennadel.com/blog/2966-rendering-image-previews-using-object-urls-vs-base64-data-uris-in-angularjs.htm)
- [React useRef for performance optimization](https://dev.to/samabaasi/mastering-useref-why-it-doesnt-trigger-re-renders-and-how-it-persists-across-re-renders-1l2b)

---

### Pitfall 3: WebSocket Connection Array Memory Leak

**What goes wrong:** When clients disconnect (tab close, navigation, network loss), WebSocket connections stay in server-side arrays. Without explicit cleanup on disconnect, the connections array grows indefinitely, consuming server memory.

**Why it happens:** Developers add connections on `open` but forget to remove them on `close`. The issue is insidious because it only manifests after many connect/disconnect cycles.

**Consequences:**
- Node.js server memory grows continuously
- Eventually triggers OOM killer or crashes
- Degraded performance as GC runs more frequently

**Prevention:**
```typescript
const connections = new Set<WebSocket>();

wss.on('connection', (ws) => {
  connections.add(ws);

  // CRITICAL: Clean up on close
  ws.on('close', () => {
    connections.delete(ws);
    // Also stop screencast if this was the last viewer
    if (connections.size === 0) {
      stopScreencast();
    }
  });

  ws.on('error', () => {
    connections.delete(ws);
  });
});
```

**Detection:** Monitor Node.js heap size over time. Count active connections vs expected connections.

**Phase to address:** Phase 1 (server-side) - must be correct in initial implementation.

**Sources:**
- [WebSocket memory leak issue ws#804](https://github.com/websockets/ws/issues/804)
- [Fixing Node memory leaks](https://softwareengineeringstandard.com/2022/08/03/how-i-fixed-a-node-memory-leak/)

---

### Pitfall 4: Zombie Browser Processes After Crash/Disconnect

**What goes wrong:** When the Node.js process crashes, the WebSocket connection breaks unexpectedly, or the user navigates away without proper cleanup, browser processes remain running as orphans. These "zombie" Chrome processes consume system resources indefinitely.

**Why it happens:**
- `browser.close()` is only called in the happy path
- Crash handlers don't account for browser cleanup
- Signal handlers (SIGTERM, SIGINT) may not be implemented
- The existing `BrowserToolset.close()` may not be called on abnormal termination

**Consequences:**
- System resources exhausted over time
- Port conflicts on restart
- Development machine slowdown
- Docker container resource limits exceeded

**Prevention:**
```typescript
// Track browser for cleanup
let activeBrowser: Browser | null = null;

// Cleanup on all exit conditions
const cleanup = async () => {
  if (activeBrowser) {
    try {
      await activeBrowser.close();
    } catch {
      // Force kill if graceful close fails
      activeBrowser.process()?.kill('SIGKILL');
    }
    activeBrowser = null;
  }
};

process.on('exit', cleanup);
process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
process.on('uncaughtException', async (err) => {
  console.error(err);
  await cleanup();
  process.exit(1);
});
```

**Detection:** Run `ps aux | grep chrome` (or `chromium`) before and after testing. Check for orphaned processes.

**Phase to address:** Phase 1 (browser lifecycle) - builds on existing `BrowserToolset.close()` pattern.

**Sources:**
- [Puppeteer zombie process issue](https://github.com/puppeteer/puppeteer/issues/1825)
- [Chrome zombie process on Linux](https://github.com/puppeteer/puppeteer/issues/5279)

---

## Moderate Pitfalls

Mistakes that cause degraded performance or poor user experience.

### Pitfall 5: Screencast Continues When No Viewers Connected

**What goes wrong:** Screencast runs continuously even when no frontend clients are viewing, wasting CPU cycles encoding frames that nobody receives.

**Why it happens:** Screencast is started when the browser launches and never stopped, or start/stop isn't tied to viewer connection state.

**Consequences:**
- Unnecessary CPU usage (frame encoding is expensive)
- Higher bandwidth if frames are sent to disconnected sockets
- Battery drain in development environments

**Prevention:**
```typescript
let viewerCount = 0;
let screencastActive = false;

function onViewerConnect() {
  viewerCount++;
  if (!screencastActive && viewerCount > 0) {
    startScreencast();
    screencastActive = true;
  }
}

function onViewerDisconnect() {
  viewerCount--;
  if (screencastActive && viewerCount === 0) {
    stopScreencast();
    screencastActive = false;
  }
}
```

**Phase to address:** Phase 2 (lifecycle management) - optimization after basic streaming works.

---

### Pitfall 6: Using Base64 Over WebSocket (30% Bandwidth Overhead)

**What goes wrong:** Sending frame data as base64 strings instead of binary increases bandwidth usage by approximately 33% (base64 encoding ratio).

**Why it happens:**
- CDP returns base64, so it's easier to pass through directly
- JSON-based WebSocket messages require string encoding
- Binary WebSocket setup requires additional configuration

**Consequences:**
- Higher bandwidth consumption
- Slower frame delivery
- More data to process on the client

**Prevention:** For development tools, base64 is acceptable. For optimization:
```typescript
// Server: decode base64 to binary
const buffer = Buffer.from(frame.data, 'base64');
ws.send(buffer); // Binary frame

// Client: receive as ArrayBuffer
socket.binaryType = 'arraybuffer';
socket.onmessage = (event) => {
  const blob = new Blob([event.data], { type: 'image/jpeg' });
  // Use blob URL...
};
```

**Phase to address:** Phase 3 (optimization) - acceptable to defer for MVP since Studio is development-only.

**Sources:**
- [WebSocket binary vs text performance](https://www.appetenza.com/websocket-handling-binary-data)

---

### Pitfall 7: Frame Rate Too High for Use Case

**What goes wrong:** Running screencast at 30 FPS when 5-10 FPS is sufficient for observing agent actions. Higher frame rates consume more CPU, bandwidth, and processing power without meaningful benefit.

**Why it happens:** Developers default to video-like frame rates without considering the actual use case (observing relatively slow browser automation).

**Consequences:**
- Unnecessary resource consumption
- Client-side performance issues
- Larger network traffic

**Prevention:**
```typescript
// CDP supports everyNthFrame parameter
await cdpSession.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 60,        // Lower quality is fine for preview
  maxWidth: 800,      // Smaller dimensions reduce data
  maxHeight: 600,
  everyNthFrame: 3    // Skip frames for lower effective FPS
});
```

**Phase to address:** Phase 1 (initial implementation) - choose appropriate defaults from the start.

---

### Pitfall 8: Object URL Memory Leak on Client

**What goes wrong:** When using `URL.createObjectURL()` for frame display, failing to call `URL.revokeObjectURL()` on previous frames causes memory to accumulate in the browser tab.

**Why it happens:** Each frame creates a new Object URL, but the previous one isn't revoked. Unlike base64 strings which are garbage collected, Object URLs must be explicitly revoked.

**Consequences:**
- Browser tab memory grows continuously
- Tab becomes unresponsive after extended viewing
- Browser may eventually crash

**Prevention:**
```typescript
const prevUrl = useRef<string | null>(null);

function handleFrame(buffer: ArrayBuffer) {
  // Revoke previous URL BEFORE creating new one
  if (prevUrl.current) {
    URL.revokeObjectURL(prevUrl.current);
  }
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  prevUrl.current = URL.createObjectURL(blob);
  imgRef.current.src = prevUrl.current;
}

// Also revoke on component unmount
useEffect(() => {
  return () => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
  };
}, []);
```

**Phase to address:** Phase 2 (if using Object URLs) - must be implemented correctly if choosing this approach.

---

### Pitfall 9: No Feedback When Screencast Is Unavailable

**What goes wrong:** The live view shows a blank/stale image or loading state indefinitely when screencast cannot be started (browser not launched, CDP connection failed, etc.) with no indication of why.

**Why it happens:** Error handling focuses on runtime errors, not the initial connection state or screencast availability.

**Consequences:**
- Users don't know if feature is working
- Confusion between "loading" and "broken"
- Support burden from unclear states

**Prevention:**
```typescript
// Server: send explicit status messages
ws.send(JSON.stringify({
  type: 'status',
  status: 'connecting_to_browser'
}));

// After browser ready:
ws.send(JSON.stringify({
  type: 'status',
  status: 'ready',
  browserConnected: true
}));

// On error:
ws.send(JSON.stringify({
  type: 'error',
  message: 'Browser not launched. Start an agent action first.'
}));
```

**Phase to address:** Phase 2 (UI integration) - important for usability.

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixed.

### Pitfall 10: Out-of-Order Frames Display Incorrectly

**What goes wrong:** Frames arrive out of order (due to network jitter or processing delays) and display in wrong sequence, causing visual glitches.

**Why it happens:** WebSocket messages can arrive out of order in edge cases, and CDP frame timestamps may not match arrival order.

**Consequences:**
- Visual stuttering or jumping backward
- Confusing user experience

**Prevention:**
```typescript
let lastFrameTimestamp = 0;

function handleFrame(frame) {
  // Drop frames older than last displayed
  if (frame.metadata.timestamp < lastFrameTimestamp) {
    return; // Skip out-of-order frame
  }
  lastFrameTimestamp = frame.metadata.timestamp;
  displayFrame(frame);
}
```

**Phase to address:** Phase 3 (polish) - minor issue for development tool.

**Sources:**
- [CDP frames out-of-order issue](https://github.com/ChromeDevTools/devtools-protocol/issues/117)

---

### Pitfall 11: Tab Visibility Reconnection Issues

**What goes wrong:** When the user switches browser tabs, the WebSocket connection may be throttled or dropped. On return, the live view shows stale content or fails to reconnect.

**Why it happens:** Browsers throttle background tabs and may close idle WebSocket connections.

**Consequences:**
- Stale preview after switching tabs
- Need to manually refresh

**Prevention:**
```typescript
// Client: handle visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (socket.readyState !== WebSocket.OPEN) {
      reconnect();
    }
    // Request fresh frame on return
    socket.send(JSON.stringify({ type: 'requestFrame' }));
  }
});
```

**Phase to address:** Phase 3 (polish) - nice-to-have for development tool.

**Sources:**
- [Page Visibility API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [WebSocket reconnection strategies](https://apidog.com/blog/websocket-reconnect/)

---

### Pitfall 12: CDP Protocol Timeout on Busy Pages

**What goes wrong:** The `Page.screencastFrameAck` call times out when the browser is busy with complex operations, causing screencast errors.

**Why it happens:** CDP has a default protocol timeout, and screencasting while running heavy automation can exceed it.

**Consequences:**
- `ProtocolError: Page.screencastFrameAck timed out`
- Screencast stops unexpectedly

**Prevention:**
```typescript
// Increase protocol timeout for screencast operations
const browser = await chromium.launch({
  // ...options
});
const context = await browser.newContext();
const page = await context.newPage();

// Set longer timeout for CDP session
const cdpSession = await page.context().newCDPSession(page);
cdpSession.setDefaultTimeout(60000); // 60 seconds
```

**Phase to address:** Phase 1 (CDP integration) - configure appropriately from start.

**Sources:**
- [Puppeteer screencast crash issue](https://github.com/puppeteer/puppeteer/issues/11767)

---

## Phase-Specific Warning Summary

| Phase | Topic | Likely Pitfall | Mitigation Priority |
|-------|-------|---------------|---------------------|
| 1 | CDP Integration | Missing frame ack (backpressure) | CRITICAL - get right first time |
| 1 | CDP Integration | Protocol timeouts | HIGH - configure appropriately |
| 1 | Server WebSocket | Connection array leak | CRITICAL - implement cleanup handlers |
| 1 | Browser Lifecycle | Zombie processes | HIGH - extend existing close() pattern |
| 2 | React Rendering | Base64 virtual DOM thrashing | CRITICAL - use useRef pattern |
| 2 | Object URLs | Memory leak without revoke | HIGH - if using Object URLs |
| 2 | UI Feedback | No status indication | MEDIUM - usability concern |
| 2 | Lifecycle | Screencast without viewers | MEDIUM - resource waste |
| 3 | Optimization | Base64 bandwidth overhead | LOW - acceptable for dev tool |
| 3 | Optimization | Frame rate too high | LOW - easy to adjust |
| 3 | Polish | Out-of-order frames | LOW - minor visual issue |
| 3 | Polish | Tab visibility reconnection | LOW - nice-to-have |

---

## Architecture Implications

Based on these pitfalls, the implementation should:

1. **Separate concerns clearly:** CDP frame handling, WebSocket management, and React rendering should be distinct layers so pitfalls in one don't cascade.

2. **Use event-driven frame delivery:** Don't poll or buffer frames. Subscribe to CDP events, ack immediately, broadcast to connected clients.

3. **Track connection lifecycle explicitly:** Maintain clear state for "browser connected," "screencast active," "viewers connected" to enable proper cleanup.

4. **Bypass React for frame updates:** The live view component should use refs for image updates, not state.

5. **Design for graceful degradation:** When screencast isn't available, show clear status rather than broken UI.

---

## Sources Index

**CDP Documentation:**
- [Chrome DevTools Protocol - Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/)

**Community Issues and Discussions:**
- [Puppeteer screencast feature request](https://github.com/microsoft/playwright/issues/2620)
- [CDP frames out-of-order](https://github.com/ChromeDevTools/devtools-protocol/issues/117)
- [Puppeteer zombie processes](https://github.com/puppeteer/puppeteer/issues/1825)
- [WebSocket memory leaks](https://github.com/websockets/ws/issues/804)
- [Screencast crash issue](https://github.com/puppeteer/puppeteer/issues/11767)

**Best Practices:**
- [Browserless screencast guide](https://www.browserless.io/blog/screencast)
- [WebSocket binary data handling](https://www.appetenza.com/websocket-handling-binary-data)
- [React useRef optimization](https://dev.to/samabaasi/mastering-useref-why-it-doesnt-trigger-re-renders-and-how-it-persists-across-re-renders-1l2b)
- [Object URLs vs Base64](https://www.bennadel.com/blog/2966-rendering-image-previews-using-object-urls-vs-base64-data-uris-in-angularjs.htm)
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
