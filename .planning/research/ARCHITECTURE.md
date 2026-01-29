# Architecture Patterns

**Domain:** Browser toolset for AI agents
**Researched:** 2026-01-26

## Recommended Architecture

```
+------------------+     +-------------------+     +------------------+
|   Mastra Agent   |---->|  Browser Toolset  |---->|  agent-browser   |
|                  |     |   (Integration)   |     |  BrowserManager  |
+------------------+     +-------------------+     +------------------+
                                 |
                                 v
                    +------------------------+
                    |    Individual Tools    |
                    +------------------------+
                    | - navigate            |
                    | - snapshot            |
                    | - click               |
                    | - type                |
                    | - scroll              |
                    | - screenshot          |
                    +------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `BrowserToolset` | Tool collection, lifecycle management, browser instance ownership | Mastra Agent (via tools interface), BrowserManager |
| `BrowserManager` | Browser automation, Playwright wrapper, accessibility tree generation | Toolset methods, underlying Chromium |
| Individual Tools | Single-purpose browser operations with Zod schemas | Toolset (shared browser), Agent (via tool calls) |
| Element Refs Registry | Maps `@e1`, `@e2` etc. to DOM elements within snapshot scope | Snapshot (generates), interaction tools (consume) |

### Data Flow

**Agent-to-Browser Flow:**

```
1. Agent receives task requiring web interaction
2. Agent calls navigate tool with URL
3. Toolset ensures browser is launched (lazy init)
4. BrowserManager navigates to URL
5. Agent calls snapshot tool
6. Snapshot returns accessibility tree with refs (@e1, @e2, etc.)
7. Agent reasons about page structure
8. Agent calls click/type with ref identifier
9. Toolset resolves ref to DOM element
10. BrowserManager executes action
```

**Ref Lifecycle:**

```
snapshot() -> generates fresh refs -> refs valid until next snapshot
click(@e5) -> uses current refs -> action executed
snapshot() -> invalidates old refs -> new refs generated
```

**Key insight:** Refs are snapshot-scoped. Each snapshot invalidates previous refs.

## Component Details

### 1. BrowserToolset Class

```typescript
class BrowserToolset {
  readonly name = 'agent-browser';
  private browserManager: BrowserManager | null = null;
  private currentRefs: Map<string, ElementHandle> = new Map();

  // Lazy initialization
  private async ensureBrowser(): Promise<BrowserManager> {
    if (!this.browserManager) {
      this.browserManager = new BrowserManager();
      await this.browserManager.launch({ headless: true });
    }
    return this.browserManager;
  }

  readonly tools = {
    navigate: createTool({ ... }),
    snapshot: createTool({ ... }),
    click: createTool({ ... }),
    type: createTool({ ... }),
    scroll: createTool({ ... }),
    screenshot: createTool({ ... }),
  };

  async close(): Promise<void> {
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = null;
    }
    this.currentRefs.clear();
  }
}
```

### 2. Tool Schemas

**Navigate:**
```typescript
inputSchema: z.object({
  url: z.string().url(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load'),
})
```

**Snapshot:**
```typescript
inputSchema: z.object({
  interactiveOnly: z.boolean().optional().default(true),
  maxDepth: z.number().optional(),
})
outputSchema: z.object({
  tree: z.string(),
  refs: z.record(z.string(), z.object({
    role: z.string(),
    name: z.string().optional(),
  })),
  elementCount: z.number(),
})
```

**Click:**
```typescript
inputSchema: z.object({
  ref: z.string().regex(/^@e\d+$/),
  button: z.enum(['left', 'right', 'middle']).optional().default('left'),
})
```

## Patterns to Follow

### Pattern 1: Lazy Browser Initialization
Browser instance created on first tool use, not at toolset construction.

### Pattern 2: Ref-Based Element Targeting
Use accessibility refs (`@e1`) instead of CSS selectors. Refs are deterministic within snapshot scope.

### Pattern 3: Snapshot-Before-Act
Always capture fresh snapshot before interactions. Refs become stale after DOM changes.

### Pattern 4: Tool Independence
Each tool callable independently. Navigate handles "no browser" case. Click handles "no snapshot taken" case.

### Pattern 5: Structured Error Returns
Return error information in output schema, don't throw for recoverable errors.

## Anti-Patterns to Avoid

1. **CSS Selector Exposure** - Selectors are brittle, LLMs hallucinate invalid selectors
2. **Browser Instance Per Tool Call** - Extremely slow, loses session state
3. **Unscoped Refs** - Refs must be cleared on every snapshot
4. **Raw DOM Dump** - Too many tokens, hard for LLM to parse

## Build Order Dependencies

```
1. BrowserToolset skeleton
   - Lazy browser initialization
   - Close/cleanup method

2. navigate tool
   - Triggers browser launch

3. snapshot tool
   - Ref generation
   - Ref registry management

4. click tool (depends on snapshot)
5. type tool (depends on snapshot)
6. scroll tool
7. screenshot tool
```

## File Structure

```
integrations/agent-browser/
  src/
    index.ts
    toolset.ts
    types.ts
    tools/
      navigate.ts
      snapshot.ts
      click.ts
      type.ts
      scroll.ts
      screenshot.ts
    __tests__/
  package.json
  README.md
```

---

# Browser Live View Architecture (Milestone 2)

**Domain:** Browser screencast streaming for Mastra Studio
**Researched:** 2026-01-27
**Confidence:** HIGH (verified with codebase analysis and agent-browser documentation)

## Recommended Architecture

```
+-------------------+     WebSocket      +-------------------+
|  Studio UI        |<------------------>|  Mastra Server    |
| (playground-ui)   |     frames/input   | (packages/server) |
+-------------------+                    +-------------------+
        |                                        |
        | React Components                       | Route Handler
        v                                        v
+-------------------+                    +-------------------+
| BrowserViewPanel  |                    | /browser/stream   |
| - frame display   |                    | - WS upgrade      |
| - input relay     |                    | - session mgmt    |
+-------------------+                    +-------------------+
                                                 |
                                                 | getBrowser()
                                                 v
                                         +-------------------+
                                         | BrowserToolset    |
                                         | (agent-browser)   |
                                         +-------------------+
                                                 |
                                                 | CDP
                                                 v
                                         +-------------------+
                                         | BrowserManager    |
                                         | - startScreencast |
                                         | - injectMouse     |
                                         | - injectKeyboard  |
                                         +-------------------+
```

### Live View Data Flow

1. **Screencast Start:** Studio connects via WebSocket to `/browser/:sessionId/stream`
2. **Frame Capture:** Server calls `browserManager.startScreencast(callback, options)`
3. **Frame Transmission:** Callback pushes base64 JPEG frames over WebSocket
4. **Input Relay:** User mouse/keyboard events sent via WebSocket to server
5. **Input Injection:** Server calls `browserManager.injectMouseEvent/injectKeyboardEvent`
6. **Cleanup:** On disconnect, server calls `stopScreencast()` and closes WS

### Component Boundaries

| Component | Responsibility | Location | Status |
|-----------|---------------|----------|--------|
| BrowserToolset | Browser lifecycle, tool execution | `integrations/agent-browser/` | EXISTS |
| BrowserManager | CDP interaction, screencast API | `agent-browser` npm package | EXISTS |
| BrowserStreamHandler | WS upgrade, session routing, frame relay | `packages/deployer/` | EXISTS |
| BrowserViewPanel | Frame display, input capture | `packages/playground-ui/` | EXISTS |

---

# Browser Input Injection Architecture (Milestone 3)

**Domain:** User input injection for browser live view
**Researched:** 2026-01-28
**Confidence:** HIGH (verified with codebase inspection of all existing components)

## Executive Summary

Input injection adds bidirectional communication to the existing browser live view. The WebSocket at `/browser/:agentId/stream` currently flows server-to-client only (frames and status messages). The `onMessage` handler on the server is an empty stub with a comment: `"Future: handle input events for Phase 10+"`. User mouse clicks, keyboard input, and scroll events need to flow from the React `BrowserViewFrame` component through this same WebSocket, be routed by the server to the correct `BrowserToolset` instance, and dispatched via CDP `Input.dispatchMouseEvent` / `Input.dispatchKeyboardEvent`.

**Critical gap found:** The `BrowserToolsetLike` interface (used by the server via `BrowserStreamConfig.getToolset`) does NOT expose `injectMouseEvent()` or `injectKeyboardEvent()`. The concrete `BrowserToolset` class has these methods, but the interface in `packages/core/src/agent/types.ts` omits them. This interface must be extended before the server can route input events.

**Second gap found:** Frame viewport metadata (width, height, offsetTop, scrollOffset, pageScaleFactor) is available per-frame from `ScreencastStream` but is NOT currently broadcast to the client. The `broadcastFrame()` method sends only `frame.data` (raw base64 string). Without viewport dimensions, the client cannot perform coordinate mapping. This metadata must be sent alongside frames.

## Complete Data Flow

### End-to-End: Mouse Click

```
USER CLICKS ON BROWSER VIEW IMAGE
         |
         v
[1] BrowserViewFrame (React)
    - img element with onMouseDown/onMouseUp/onMouseMove handlers
    - Gets click position relative to img element via getBoundingClientRect()
    - Accounts for object-contain letterboxing
    - Maps to viewport coordinates using last-known viewport dimensions
         |
         v
[2] useBrowserStream hook (or new useInputInjection hook)
    - Sends JSON message over existing WebSocket (wsRef.current)
    - Message: { type: "mouse", event: { type: "mousePressed", x, y, button, clickCount } }
         |
         v
[3] WebSocket transport (existing /browser/:agentId/stream)
    - Same WebSocket connection used for frame delivery
    - Client -> Server direction (currently unused)
         |
         v
[4] browser-stream.ts onMessage handler
    - Parses JSON message
    - Validates message structure
    - Delegates to ViewerRegistry or directly to toolset
         |
         v
[5] ViewerRegistry (or direct toolset lookup)
    - Uses config.getToolset(agentId) to get BrowserToolsetLike
    - Calls toolset.injectMouseEvent(event) <-- REQUIRES INTERFACE EXTENSION
         |
         v
[6] BrowserToolset.injectMouseEvent()
    - Delegates to BrowserManager.injectMouseEvent()
    - Already implemented in toolset.ts lines 273-285
         |
         v
[7] BrowserManager.injectMouseEvent()
    - Sends CDP Input.dispatchMouseEvent to Chromium
    - Coordinates are in CSS pixels relative to main frame viewport
         |
         v
[8] Chromium processes the event
    - Page reacts (button click, link navigation, etc.)
    - New frame captured by screencast -> broadcast back to client
```

### End-to-End: Keyboard Input

```
USER TYPES ON KEYBOARD WHILE BROWSER VIEW IS FOCUSED
         |
         v
[1] BrowserViewFrame (React)
    - Container div with tabIndex={0} for keyboard focus
    - onKeyDown/onKeyUp handlers capture key events
    - Must preventDefault() to avoid browser shortcuts
         |
         v
[2] useBrowserStream / useInputInjection
    - Sends JSON: { type: "keyboard", event: { type: "keyDown", key, code, text, modifiers } }
    - For printable characters: sends keyDown, then char (with text), then keyUp
         |
         v
[3-7] Same pipeline as mouse events through WebSocket -> server -> CDP
    - Server calls toolset.injectKeyboardEvent(event)
    - BrowserManager sends CDP Input.dispatchKeyEvent
```

### End-to-End: Scroll

```
USER SCROLLS MOUSE WHEEL OVER BROWSER VIEW
         |
         v
[1] BrowserViewFrame (React)
    - onWheel handler captures scroll events
    - Maps deltaX/deltaY to viewport coordinates
         |
         v
[2] useBrowserStream / useInputInjection
    - Sends JSON: { type: "mouse", event: { type: "mouseWheel", x, y, deltaX, deltaY } }
    - x, y = cursor position in viewport coordinates (where scroll should apply)
         |
         v
[3-7] Same pipeline - routed as a mouseWheel CDP event
```

## WebSocket Message Types

### Client -> Server (NEW -- currently no client messages exist)

All input messages share a common envelope:

```typescript
/**
 * Base envelope for all client-to-server input messages.
 * The 'type' field discriminates between input categories.
 */
type ClientInputMessage = MouseInputMessage | KeyboardInputMessage;

/**
 * Mouse event message sent from client to server.
 * Coordinates are pre-mapped to CDP viewport coordinates by the client.
 */
interface MouseInputMessage {
  type: 'mouse';
  event: {
    type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
    /** X coordinate in CDP viewport CSS pixels */
    x: number;
    /** Y coordinate in CDP viewport CSS pixels */
    y: number;
    /** Mouse button */
    button?: 'left' | 'right' | 'middle' | 'none';
    /** Click count (1 for single, 2 for double) */
    clickCount?: number;
    /** Scroll delta X (mouseWheel only) */
    deltaX?: number;
    /** Scroll delta Y (mouseWheel only) */
    deltaY?: number;
    /** Modifier keys bitmask: Alt=1, Ctrl=2, Meta=4, Shift=8 */
    modifiers?: number;
  };
}

/**
 * Keyboard event message sent from client to server.
 * Maps directly to CDP Input.dispatchKeyEvent parameters.
 */
interface KeyboardInputMessage {
  type: 'keyboard';
  event: {
    type: 'keyDown' | 'keyUp' | 'char';
    /** DOM key value (e.g., "Enter", "a", "Shift") */
    key?: string;
    /** DOM physical key code (e.g., "KeyA", "Enter") */
    code?: string;
    /** Text generated by the key (printable chars only) */
    text?: string;
    /** Modifier keys bitmask: Alt=1, Ctrl=2, Meta=4, Shift=8 */
    modifiers?: number;
  };
}
```

### Server -> Client (EXISTING + EXTENSION)

Currently the server sends:
- **JSON status messages:** `{ status: "connected" | "browser_starting" | "streaming" | "browser_closed" }`
- **JSON URL updates:** `{ url: "https://..." }`
- **Raw base64 strings:** Frame image data (non-JSON, detected by not starting with `{`)

**Required extension for input injection -- viewport metadata:**

The client needs viewport dimensions to perform coordinate mapping. Two options:

**Option A (Recommended): Send viewport with each frame as JSON envelope**
```typescript
// Instead of raw base64, send:
{ frame: "<base64>", viewport: { width: 1280, height: 720 } }
```

This is a BREAKING CHANGE to the frame protocol. The client currently detects frames as "non-JSON strings." Switching to JSON frames would require updating `useBrowserStream`'s message parsing. However, it is the cleanest approach.

**Option B: Send viewport as separate metadata message on change**
```typescript
{ viewport: { width: 1280, height: 720, offsetTop: 0, pageScaleFactor: 1 } }
```

This preserves backward compatibility (raw base64 frames continue unchanged) but means viewport data may arrive out-of-order relative to frames.

**Recommendation: Option A.** The frame protocol should evolve to JSON envelopes. The viewport dimensions are constant for the lifetime of a screencast session (set at `startScreencast` time via `maxWidth`/`maxHeight`), so they could also be sent once as a metadata message at screencast start. But Option A is more robust because:
1. Viewport metadata is per-frame in the CDP API (each frame includes deviceWidth/deviceHeight)
2. If the page changes zoom level, pageScaleFactor changes mid-stream
3. JSON envelope enables future extension (frame sequence numbers, timestamps)

**However**, Option A has a performance cost: JSON.stringify for every frame adds overhead. A practical hybrid approach:

**Option C (Best): Send viewport once at stream start, update on change, keep raw frames**
```typescript
// On screencast start or viewport change:
{ viewport: { width: 1280, height: 720, offsetTop: 0, pageScaleFactor: 1 } }

// Frames remain raw base64 (no JSON wrapping) for performance:
"/9j/4AAQ..." (raw base64 string)
```

The client stores the last-received viewport dimensions and uses them for coordinate mapping. Since screencast dimensions are configured at start (maxWidth=1280, maxHeight=720), the viewport rarely changes during a session.

**Final recommendation: Option C.** Minimal protocol change, no frame-level performance hit, and the client already handles JSON messages (`data.startsWith('{')`) separately from raw frame strings.

## Coordinate Mapping (Client-Side)

### The Challenge

The `<img>` element in `BrowserViewFrame` uses CSS class `object-contain`, which means:
- The image is scaled to fit within the container while preserving aspect ratio
- If the container aspect ratio differs from the image, there will be letterboxing (black bars)
- A click at pixel (100, 50) on the displayed image does NOT correspond to viewport pixel (100, 50)

### Mapping Algorithm

```typescript
/**
 * Maps a mouse event position on the displayed <img> element
 * to CDP viewport coordinates.
 *
 * Accounts for:
 * 1. object-contain letterboxing (image may not fill container)
 * 2. Scale difference between displayed size and actual viewport
 */
function mapToViewportCoords(
  clientX: number,
  clientY: number,
  imgElement: HTMLImageElement,
  viewport: { width: number; height: number }
): { x: number; y: number } | null {
  const rect = imgElement.getBoundingClientRect();

  // Calculate the actual rendered image dimensions within the object-contain box
  const imgAspect = viewport.width / viewport.height;
  const containerAspect = rect.width / rect.height;

  let renderedWidth: number;
  let renderedHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (imgAspect > containerAspect) {
    // Image is wider than container -- letterboxed top/bottom
    renderedWidth = rect.width;
    renderedHeight = rect.width / imgAspect;
    offsetX = 0;
    offsetY = (rect.height - renderedHeight) / 2;
  } else {
    // Image is taller than container -- letterboxed left/right
    renderedHeight = rect.height;
    renderedWidth = rect.height * imgAspect;
    offsetX = (rect.width - renderedWidth) / 2;
    offsetY = 0;
  }

  // Position relative to the img element
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;

  // Position relative to the rendered image (excluding letterbox)
  const imgX = relX - offsetX;
  const imgY = relY - offsetY;

  // Check if click is within the rendered image area (not in letterbox)
  if (imgX < 0 || imgX > renderedWidth || imgY < 0 || imgY > renderedHeight) {
    return null; // Click was in letterbox area, ignore
  }

  // Scale to viewport coordinates
  const viewportX = (imgX / renderedWidth) * viewport.width;
  const viewportY = (imgY / renderedHeight) * viewport.height;

  return {
    x: Math.round(viewportX),
    y: Math.round(viewportY),
  };
}
```

### Why Client-Side Mapping

Coordinate mapping MUST happen client-side because:

1. **Only the client knows the `<img>` element's rendered dimensions.** The server has no knowledge of the CSS layout, container size, or letterboxing.
2. **The viewport dimensions are known to the client** (sent via metadata message).
3. **Latency**: Sending raw pixel coordinates to the server for mapping would add a round-trip before the server could even dispatch the CDP event. Client-side mapping means the message sent to the server already contains final CDP coordinates.
4. **Separation of concerns**: The server just forwards coordinates to CDP. It does not need to know about UI rendering.

### What About Input State (Cursor, Focus)?

**Cursor position:** Track client-side only. The server and CDP do not need persistent cursor state -- each `mouseMoved` event is independent.

**Keyboard focus:** Track client-side only. Use a `tabIndex={0}` container `<div>` around the browser view. When focused, keyboard events are captured. When not focused (user clicks outside), keyboard events stop. The browser page itself manages its own DOM focus state in response to dispatched click events.

**Button state (mousedown without mouseup):** Track client-side. If the user mousedowns on the image, moves outside, and mouseups outside, we should still send the mouseReleased to prevent stuck buttons. Use `onPointerDown` + `setPointerCapture` to track this.

## Files That Need Modification vs New Files

### MUST MODIFY (Existing Files)

| File | What Changes | Why |
|------|-------------|-----|
| `packages/core/src/agent/types.ts` | Add `injectMouseEvent()` and `injectKeyboardEvent()` to `BrowserToolsetLike` interface | Server needs these methods on the interface it uses to interact with toolsets |
| `packages/deployer/src/server/browser-stream/browser-stream.ts` | Implement `onMessage` handler (currently empty stub) | Route incoming input messages to toolset |
| `packages/deployer/src/server/browser-stream/types.ts` | Add `ClientInputMessage` types and extend `BrowserStreamConfig` | Type safety for input message handling |
| `packages/deployer/src/server/browser-stream/viewer-registry.ts` | Add `broadcastViewport()` method; modify frame handler to track and send viewport metadata; add `handleInputMessage()` or expose toolset for input routing | ViewerRegistry manages the toolset reference and needs to either route input or expose the toolset |
| `packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts` | Add `sendMessage()` return value; parse viewport metadata messages; track viewport state | Client needs to send input and know viewport dimensions |
| `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx` | Add mouse/keyboard/scroll event handlers on the img container; add coordinate mapping; add focus management | This is where user interaction happens |

### MAY CREATE (New Files)

| File | Purpose | When |
|------|---------|------|
| `packages/playground-ui/src/domains/agents/hooks/use-input-injection.ts` | Encapsulate coordinate mapping, event throttling, modifier key tracking, focus state | If the logic is too complex for `use-browser-stream.ts` alone |
| `packages/playground-ui/src/domains/agents/utils/coordinate-mapping.ts` | Pure function for `object-contain` letterbox coordinate math | Keeps BrowserViewFrame clean; easy to unit test |

### DO NOT MODIFY

| File | Reason |
|------|--------|
| `integrations/agent-browser/src/toolset.ts` | Already has `injectMouseEvent()` and `injectKeyboardEvent()` -- no changes needed |
| `integrations/agent-browser/src/screencast/` | Screencast stream already emits viewport metadata per frame -- no changes needed |

## Detailed Change Specifications

### 1. Extend BrowserToolsetLike Interface

**File:** `packages/core/src/agent/types.ts`

Add to `BrowserToolsetLike` interface (after `close(): Promise<void>`):

```typescript
export interface BrowserToolsetLike {
  // ... existing methods ...

  /** Inject a mouse event via CDP passthrough */
  injectMouseEvent(event: {
    type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
    x: number;
    y: number;
    button?: 'left' | 'right' | 'middle' | 'none';
    clickCount?: number;
    deltaX?: number;
    deltaY?: number;
    modifiers?: number;
  }): Promise<void>;

  /** Inject a keyboard event via CDP passthrough */
  injectKeyboardEvent(event: {
    type: 'keyDown' | 'keyUp' | 'char';
    key?: string;
    code?: string;
    text?: string;
    modifiers?: number;
  }): Promise<void>;
}
```

This matches the exact signatures already on the concrete `BrowserToolset` class (toolset.ts lines 273-302), so no changes are needed there.

### 2. Server onMessage Handler

**File:** `packages/deployer/src/server/browser-stream/browser-stream.ts`

Replace the empty `onMessage` stub:

```typescript
onMessage(event, _ws) {
  // Parse and validate input message
  const raw = typeof event.data === 'string' ? event.data : '';
  if (!raw.startsWith('{')) return; // Ignore non-JSON

  let msg: ClientInputMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return; // Silently ignore malformed messages
  }

  // Get toolset for this agent
  const toolset = config.getToolset(agentId);
  if (!toolset) return;

  // Route by message type
  if (msg.type === 'mouse') {
    void toolset.injectMouseEvent(msg.event);
  } else if (msg.type === 'keyboard') {
    void toolset.injectKeyboardEvent(msg.event);
  }
},
```

Note: Input injection is fire-and-forget (`void`). We do not await results or send acknowledgments. This keeps latency minimal -- the user sees the effect via the next screencast frame.

### 3. Viewport Metadata Broadcasting

**File:** `packages/deployer/src/server/browser-stream/viewer-registry.ts`

In `doStartScreencast`, modify the frame handler to also broadcast viewport on first frame or change:

```typescript
private lastViewport = new Map<string, { width: number; height: number }>();

// In doStartScreencast, modify the frame handler:
stream.on('frame', frame => {
  this.broadcastFrame(agentId, frame.data);
  this.broadcastUrlIfChanged(agentId, toolset.getCurrentUrl());
  this.broadcastViewportIfChanged(agentId, frame.viewport);
});

private broadcastViewportIfChanged(
  agentId: string,
  viewport: { width: number; height: number }
): void {
  const last = this.lastViewport.get(agentId);
  if (last && last.width === viewport.width && last.height === viewport.height) {
    return;
  }
  this.lastViewport.set(agentId, viewport);

  const viewerSet = this.viewers.get(agentId);
  if (!viewerSet) return;

  const message = JSON.stringify({ viewport });
  for (const ws of viewerSet) {
    try { ws.send(message); } catch { /* ignore */ }
  }
}
```

### 4. Client Viewport Tracking and Message Sending

**File:** `packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts`

Extend the hook return type:

```typescript
interface UseBrowserStreamReturn {
  // ... existing ...
  viewport: { width: number; height: number } | null;
  sendInputMessage: (msg: ClientInputMessage) => void;
}
```

Add viewport state and parse viewport messages in `onmessage`:

```typescript
const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);

// In onmessage JSON parsing:
if (parsed.viewport !== undefined) {
  setViewport(parsed.viewport);
}

// Send function:
const sendInputMessage = useCallback((msg: ClientInputMessage) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify(msg));
  }
}, []);
```

### 5. BrowserViewFrame Input Handlers

**File:** `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx`

The `<img>` element needs to be wrapped in a focusable container with event handlers:

```typescript
export function BrowserViewFrame({ agentId, className, onStatusChange, onUrlChange }: BrowserViewFrameProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // ... existing state ...

  const { status, error, currentUrl, connect, viewport, sendInputMessage } = useBrowserStream({
    agentId,
    enabled: true,
    onFrame: handleFrame,
  });

  // Coordinate mapping
  const mapCoords = useCallback((clientX: number, clientY: number) => {
    if (!imgRef.current || !viewport) return null;
    return mapToViewportCoords(clientX, clientY, imgRef.current, viewport);
  }, [viewport]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const coords = mapCoords(e.clientX, e.clientY);
    if (!coords) return;
    sendInputMessage({
      type: 'mouse',
      event: {
        type: 'mousePressed',
        ...coords,
        button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle',
        clickCount: e.detail,
        modifiers: getModifiers(e),
      },
    });
  }, [mapCoords, sendInputMessage]);

  // ... similar for mouseUp, mouseMove, wheel, keyboard ...

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative w-full aspect-video bg-surface2 rounded-md overflow-hidden outline-none focus:ring-2 focus:ring-accent1"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={e => e.preventDefault()}
    >
      <img ref={imgRef} ... />
      {/* ... existing overlays ... */}
    </div>
  );
}
```

## Build Order (Dependency-Driven)

Each step depends on the previous. Cannot be parallelized.

```
Step 1: BrowserToolsetLike interface extension
   packages/core/src/agent/types.ts
   WHY FIRST: Server cannot call injectMouseEvent without this.
   RISK: Low -- additive interface change, existing BrowserToolset already implements it.
   VERIFY: TypeScript compile check passes.

Step 2: Viewport metadata broadcasting (server)
   packages/deployer/src/server/browser-stream/viewer-registry.ts
   WHY SECOND: Client needs viewport data before it can map coordinates.
   DEPENDS ON: Nothing new (uses existing frame.viewport data).
   VERIFY: Connect WebSocket client, verify viewport JSON message received.

Step 3: Client viewport tracking + send capability
   packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts
   WHY THIRD: Components need the hook API before they can add handlers.
   DEPENDS ON: Step 2 (viewport messages from server).
   VERIFY: Hook returns viewport state and sendInputMessage function.

Step 4: Server onMessage handler
   packages/deployer/src/server/browser-stream/browser-stream.ts
   packages/deployer/src/server/browser-stream/types.ts
   WHY FOURTH: Must exist before client sends messages.
   DEPENDS ON: Step 1 (BrowserToolsetLike interface).
   VERIFY: Send JSON via WebSocket, see CDP event fired.

Step 5: Client input event handlers + coordinate mapping
   packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx
   (+ optional utility file for coordinate mapping)
   WHY LAST: Needs all previous steps -- viewport from server, send capability, server handler.
   DEPENDS ON: Steps 2, 3, 4.
   VERIFY: Click on image, see click in browser. Type, see text appear.
```

### Parallelization Note

Steps 2 and 4 are independent of each other (server-side changes that touch different concerns). They COULD be built in parallel if desired. But they both must be done before Step 5.

```
     [Step 1: Interface]
            |
     +------+------+
     |             |
[Step 2: Viewport] [Step 4: onMessage]
     |             |
     +------+------+
            |
     [Step 3: Hook]
            |
     [Step 5: UI Handlers]
```

## Input Event Patterns and Edge Cases

### Mouse Event Sequence

A single click on a web page generates multiple CDP events:

```
mouseMoved (to position)    -- optional, if cursor moved
mousePressed (at position)  -- button down
mouseReleased (at position) -- button up
```

A double-click:
```
mousePressed  (clickCount: 1)
mouseReleased (clickCount: 1)
mousePressed  (clickCount: 2)
mouseReleased (clickCount: 2)
```

**Recommendation:** Map React events directly:
- `onMouseMove` -> `mouseMoved`
- `onMouseDown` -> `mousePressed`
- `onMouseUp` -> `mouseReleased`
- `onWheel` -> `mouseWheel`

React's `event.detail` provides the click count (1, 2, 3...).

### Keyboard Event Sequence

For a printable character like "a":
```
keyDown  (key: "a", code: "KeyA")
char     (text: "a")               -- MUST send for text input to work
keyUp    (key: "a", code: "KeyA")
```

For a non-printable key like Enter:
```
keyDown  (key: "Enter", code: "Enter")
keyUp    (key: "Enter", code: "Enter")
```

**Recommendation:** Map React events:
- `onKeyDown` -> send `keyDown`, and if `event.key.length === 1` also send `char` with `text: event.key`
- `onKeyUp` -> send `keyUp`

### Modifier Key Bitmask

CDP uses a bitmask for modifier keys:
- Alt = 1
- Ctrl = 2
- Meta/Command = 4
- Shift = 8

```typescript
function getModifiers(e: React.MouseEvent | React.KeyboardEvent): number {
  let modifiers = 0;
  if (e.altKey) modifiers |= 1;
  if (e.ctrlKey) modifiers |= 2;
  if (e.metaKey) modifiers |= 4;
  if (e.shiftKey) modifiers |= 8;
  return modifiers;
}
```

### Scroll Handling

`onWheel` provides `deltaX` and `deltaY` in pixels. CDP `mouseWheel` expects `deltaX` and `deltaY` in DIPs (device-independent pixels). Since the screencast viewport is in CSS pixels (which are DIPs), the values map directly.

However, scroll delta magnitudes vary wildly between trackpad and mouse wheel. Consider clamping:
```typescript
const MAX_SCROLL_DELTA = 500; // Prevent absurd scroll jumps
const clampedDeltaX = Math.max(-MAX_SCROLL_DELTA, Math.min(MAX_SCROLL_DELTA, e.deltaX));
const clampedDeltaY = Math.max(-MAX_SCROLL_DELTA, Math.min(MAX_SCROLL_DELTA, e.deltaY));
```

### Mouse Move Throttling

`onMouseMove` fires at the browser's refresh rate (up to 60-120 times per second). Sending every event over WebSocket is wasteful and can cause backpressure.

**Recommendation:** Throttle to ~30 events/second using `requestAnimationFrame`:

```typescript
const pendingMoveRef = useRef<MouseInputMessage | null>(null);
const rafRef = useRef<number | null>(null);

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  const coords = mapCoords(e.clientX, e.clientY);
  if (!coords) return;

  pendingMoveRef.current = {
    type: 'mouse',
    event: { type: 'mouseMoved', ...coords, modifiers: getModifiers(e) },
  };

  if (!rafRef.current) {
    rafRef.current = requestAnimationFrame(() => {
      if (pendingMoveRef.current) {
        sendInputMessage(pendingMoveRef.current);
        pendingMoveRef.current = null;
      }
      rafRef.current = null;
    });
  }
}, [mapCoords, sendInputMessage]);
```

### Pointer Capture for Drag

When the user mousedowns on the image and drags outside the element, we need to continue tracking the mouse and send mouseReleased when they release:

```typescript
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  // ... send mousePressed ...
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
}, [...]);

const handleMouseUp = useCallback((e: React.MouseEvent) => {
  // ... send mouseReleased ...
  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
}, [...]);
```

Use `onPointerDown`/`onPointerUp` instead of `onMouseDown`/`onMouseUp` if using pointer capture.

### Context Menu Prevention

Right-clicks should be forwarded to the remote browser, not open the local context menu:

```typescript
onContextMenu={e => e.preventDefault()}
```

### Keyboard Focus Management

The browser view container needs `tabIndex={0}` to receive keyboard focus. Show a visual focus ring so users know when they're "typing into the browser":

```
focus:ring-2 focus:ring-accent1
```

Also prevent browser default shortcuts (Ctrl+A, Ctrl+S, etc.) when focused:

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  e.preventDefault(); // Prevent local browser action
  // ... send to remote browser ...
}, [...]);
```

## Anti-Patterns to Avoid (Input Injection Specific)

### Anti-Pattern: Server-Side Coordinate Mapping
**What:** Sending raw element-relative pixel coordinates to server, having server map them
**Why bad:** Server has no knowledge of client CSS layout, letterboxing, or container dimensions
**Instead:** Client maps to viewport coordinates, server just forwards to CDP

### Anti-Pattern: Synchronous Input Acknowledgment
**What:** Awaiting server response for each input event before allowing next
**Why bad:** Adds 10-50ms round-trip latency per event. Mouse movement becomes unusable.
**Instead:** Fire-and-forget. User sees results via next screencast frame.

### Anti-Pattern: Separate WebSocket for Input
**What:** Creating a second WebSocket connection for input events
**Why bad:** Additional connection overhead, complexity, potential ordering issues
**Instead:** Use the existing screencast WebSocket bidirectionally

### Anti-Pattern: Sending All Mouse Moves
**What:** Forwarding every `onMouseMove` event without throttling
**Why bad:** 60-120 events/second overwhelms WebSocket and CDP
**Instead:** Throttle with `requestAnimationFrame` (~30/sec max)

### Anti-Pattern: Server-Side Focus Tracking
**What:** Maintaining keyboard focus state on the server
**Why bad:** Focus is a UI concern. CDP handles DOM focus via dispatched click events.
**Instead:** Client manages focus (tabIndex + visual ring). Server just forwards key events.

## Sources

- **Codebase inspection (HIGH confidence)**:
  - `integrations/agent-browser/src/toolset.ts` -- concrete BrowserToolset with injectMouseEvent/injectKeyboardEvent (lines 273-302)
  - `packages/core/src/agent/types.ts` -- BrowserToolsetLike interface (lines 63-100), notably MISSING inject methods
  - `packages/deployer/src/server/browser-stream/browser-stream.ts` -- WebSocket handler with empty onMessage stub (line 54)
  - `packages/deployer/src/server/browser-stream/viewer-registry.ts` -- broadcastFrame sends only frame.data, not viewport metadata (line 231)
  - `packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts` -- no send capability, no viewport state
  - `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx` -- img with object-contain, no event handlers

- **Chrome DevTools Protocol Input domain (HIGH confidence)**:
  - [Input domain (tip-of-tree)](https://chromedevtools.github.io/devtools-protocol/tot/Input/)
  - [Input domain (stable v1.3)](https://chromedevtools.github.io/devtools-protocol/1-3/Input/)
  - dispatchMouseEvent: type (required), x (required), y (required), button, clickCount, deltaX, deltaY, modifiers
  - dispatchKeyEvent: type (required), key, code, text, modifiers
  - Modifier bitmask: Alt=1, Ctrl=2, Meta=4, Shift=8

- **Screencast frame metadata (HIGH confidence)**:
  - `integrations/agent-browser/src/screencast/types.ts` -- ScreencastFrameData.viewport includes width, height, offsetTop, scrollOffsetX/Y, pageScaleFactor
  - `integrations/agent-browser/src/screencast/constants.ts` -- defaults: maxWidth=1280, maxHeight=720

---

*Architecture research: 2026-01-26 (v1.0), 2026-01-27 (live view), 2026-01-28 (input injection)*
