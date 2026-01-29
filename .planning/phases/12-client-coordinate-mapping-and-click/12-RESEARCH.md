# Phase 12: Client Coordinate Mapping and Click - Research

**Researched:** 2026-01-29
**Domain:** CSS object-fit coordinate mapping, CDP mouse/scroll event composition, cross-browser wheel normalization, rAF throttling
**Confidence:** HIGH

## Summary

This phase implements the client-side mouse interaction layer for the browser live view. The user clicks, scrolls, and moves their mouse on a scaled `<img>` element displayed with `object-fit: contain`. The client must map those display-space coordinates back to browser viewport CSS pixels, compose the correct CDP multi-event sequences (mouseMoved + mousePressed + mouseReleased for clicks), and send them as `MouseInputMessage` JSON over the existing WebSocket. The server routing from Phase 11 handles the rest.

The core technical challenge is the **coordinate mapping through object-fit: contain letterboxing**. When the browser viewport aspect ratio differs from the `<img>` element's aspect ratio, the rendered image is centered within the element with black bars (letterbox or pillarbox). There is no browser API that exposes the rendered content rect inside an `object-fit: contain` element; the mapping must be computed from `getBoundingClientRect()` and the known browser viewport dimensions (delivered as `ViewportMessage` from Phase 10). Clicks in the letterbox region must be rejected. The mapping function is pure arithmetic with no accumulated state, ensuring zero drift from center to corners.

Secondary concerns are: cross-browser wheel delta normalization (`deltaMode` 0/1/2 must all become CSS pixels), modifier key capture (JS `event.altKey`/`ctrlKey`/`metaKey`/`shiftKey` mapped to CDP bitmask 1/2/4/8), right-click forwarding (suppress host `contextmenu` via `preventDefault`), and mouseMoved throttling (rAF gating with delta-time check for 30fps cap).

**Primary recommendation:** Create a pure `mapClientToViewport()` function for coordinate mapping, a `useMouseInteraction` hook that attaches mouse/wheel/contextmenu listeners to the `<img>` element, composes CDP event sequences, and sends them via the existing WebSocket ref. Extend `useBrowserStream` to parse `ViewportMessage` and expose `viewport` state. All coordinate math is a standalone pure function that can be unit tested without DOM.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | >=19.0.0 | UI framework (already in project) | Existing peer dependency |
| TypeScript | catalog: | Type safety (already configured) | Existing dev dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | No new dependencies needed | All required APIs are browser-native |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled coordinate math | `get-object-fit-rect` npm package | Package adds a dependency for ~20 lines of math; not worth it for one use site |
| Hand-rolled rAF throttle | `raf-throttle` or `frame-throttle` npm | Same: ~10 lines of code, not worth a dependency |
| Hand-rolled wheel normalization | `normalize-wheel` npm | Abandoned/unmaintained; better to write the 5-line normalizer inline |

**Installation:**
```bash
# No new packages needed - all infrastructure exists from Phases 8-11
```

## Architecture Patterns

### Recommended Module Structure
```
packages/playground-ui/src/domains/agents/
├── hooks/
│   ├── use-browser-stream.ts          # MODIFY: parse ViewportMessage, expose viewport + sendMessage
│   └── use-mouse-interaction.ts       # CREATE: mouse/wheel/context event handling
├── utils/
│   └── coordinate-mapping.ts          # CREATE: pure coordinate math (no React)
└── components/browser-view/
    └── browser-view-frame.tsx          # MODIFY: wire useMouseInteraction to <img>
```

### Pattern 1: Pure Coordinate Mapping Function
**What:** Extract all coordinate math into a standalone pure function with no DOM dependencies.
**When to use:** Always -- this is the core of the phase.
**Why:** Pure functions are trivially testable, have no side effects, and make the math explicit. The function takes element rect, viewport dimensions, and client coordinates as inputs, and returns either mapped viewport coordinates or `null` (if click is in letterbox).

**Example:**
```typescript
// coordinate-mapping.ts
// Source: derived from object-fit: contain specification behavior

interface ElementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ViewportDimensions {
  width: number;
  height: number;
}

interface MappedCoordinates {
  x: number;
  y: number;
}

/**
 * Map a client mouse position on a scaled <img> element to browser viewport
 * CSS pixel coordinates, accounting for object-fit: contain letterboxing.
 *
 * Returns null if the click is in the letterbox region (black bars).
 *
 * @param clientX - MouseEvent.clientX
 * @param clientY - MouseEvent.clientY
 * @param elemRect - Result of imgElement.getBoundingClientRect()
 * @param viewport - Browser viewport dimensions from ViewportMessage
 */
export function mapClientToViewport(
  clientX: number,
  clientY: number,
  elemRect: ElementRect,
  viewport: ViewportDimensions,
): MappedCoordinates | null {
  // Position relative to the <img> element
  const relX = clientX - elemRect.left;
  const relY = clientY - elemRect.top;

  // Scale factor used by object-fit: contain
  const scale = Math.min(
    elemRect.width / viewport.width,
    elemRect.height / viewport.height,
  );

  // Rendered image dimensions within the element
  const renderedWidth = viewport.width * scale;
  const renderedHeight = viewport.height * scale;

  // Letterbox/pillarbox offsets (centered)
  const offsetX = (elemRect.width - renderedWidth) / 2;
  const offsetY = (elemRect.height - renderedHeight) / 2;

  // Position relative to the rendered image
  const imageX = relX - offsetX;
  const imageY = relY - offsetY;

  // Reject clicks in letterbox region
  if (imageX < 0 || imageY < 0 || imageX > renderedWidth || imageY > renderedHeight) {
    return null;
  }

  // Map to browser viewport coordinates
  return {
    x: imageX / scale,
    y: imageY / scale,
  };
}
```

### Pattern 2: Extend useBrowserStream to Parse Viewport and Expose sendMessage
**What:** Modify the existing `useBrowserStream` hook to (a) parse `{ viewport: { width, height } }` JSON messages from the server and expose as state, and (b) expose the WebSocket ref's `send()` as a stable callback for input injection.
**When to use:** Required for Phase 12 -- the mouse interaction hook needs viewport dimensions and a send channel.
**Why:** The WebSocket is managed by `useBrowserStream`. Rather than creating a second WebSocket or passing the ref around, the hook should expose what downstream consumers need.

**Example:**
```typescript
// In use-browser-stream.ts, add to the return type:
interface UseBrowserStreamReturn {
  // ... existing fields ...
  viewport: { width: number; height: number } | null;
  sendMessage: (data: string) => void;
}

// In the onmessage handler, add viewport parsing:
if (parsed.viewport) {
  setViewport(parsed.viewport);
}

// Expose sendMessage as stable callback:
const sendMessage = useCallback((data: string) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(data);
  }
}, []);
```

### Pattern 3: useMouseInteraction Hook
**What:** A custom React hook that attaches mouse, wheel, and contextmenu event listeners to an img element ref and sends CDP input messages over WebSocket.
**When to use:** Attached to the `<img>` element in `BrowserViewFrame`.
**Why:** Isolates all event handling logic from the rendering component. The hook composes the correct CDP event sequences and handles throttling internally.

**Example:**
```typescript
// use-mouse-interaction.ts
interface UseMouseInteractionOptions {
  imgRef: React.RefObject<HTMLImageElement | null>;
  viewport: { width: number; height: number } | null;
  sendMessage: (data: string) => void;
  enabled: boolean;
}

export function useMouseInteraction({
  imgRef,
  viewport,
  sendMessage,
  enabled,
}: UseMouseInteractionOptions): void {
  // Event listeners attached via useEffect
  // Internally uses mapClientToViewport for coordinate mapping
  // Composes multi-event sequences for clicks
  // Throttles mouseMoved via rAF + delta-time
}
```

### Pattern 4: CDP Click Event Sequence Composition
**What:** The client composes the 3-event CDP click sequence: mouseMoved to target position, then mousePressed, then mouseReleased.
**When to use:** Every click event handler.
**Why:** CDP requires explicit multi-event sequences. The server (Phase 11) is a pass-through router -- it does NOT compose sequences. Each event is a separate WebSocket message.

**Example:**
```typescript
function sendClick(
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle',
  modifiers: number,
  send: (data: string) => void,
): void {
  // CDP requires mouseMoved to position first
  send(JSON.stringify({
    type: 'mouse',
    eventType: 'mouseMoved',
    x,
    y,
    modifiers,
  }));

  // Then mousePressed
  send(JSON.stringify({
    type: 'mouse',
    eventType: 'mousePressed',
    x,
    y,
    button,
    clickCount: 1,
    modifiers,
  }));

  // Then mouseReleased
  send(JSON.stringify({
    type: 'mouse',
    eventType: 'mouseReleased',
    x,
    y,
    button,
    clickCount: 1,
    modifiers,
  }));
}
```

### Pattern 5: rAF-Gated Throttle for mouseMoved
**What:** Use `requestAnimationFrame` with a delta-time check to throttle mouseMoved events to approximately 30 events per second.
**When to use:** For `mousemove` event handler on the `<img>` element.
**Why:** Mouse events fire at display refresh rate (60-120Hz). Sending all of them floods the WebSocket. rAF naturally aligns with the render loop, and the delta-time check caps at 30fps regardless of display refresh rate.

**Example:**
```typescript
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS; // ~33.33ms

// In useEffect:
let rafId: number | null = null;
let lastMoveTime = 0;
let pendingMoveEvent: MouseEvent | null = null;

const handleMouseMove = (e: MouseEvent) => {
  pendingMoveEvent = e;
  if (rafId !== null) return; // Already scheduled

  rafId = requestAnimationFrame((now) => {
    rafId = null;
    if (!pendingMoveEvent) return;

    const delta = now - lastMoveTime;
    if (delta < FRAME_INTERVAL) return; // Too soon

    lastMoveTime = now;
    // Map coordinates and send mouseMoved
    const mapped = mapClientToViewport(
      pendingMoveEvent.clientX,
      pendingMoveEvent.clientY,
      imgRef.current!.getBoundingClientRect(),
      viewport,
    );
    if (mapped) {
      send(JSON.stringify({
        type: 'mouse',
        eventType: 'mouseMoved',
        x: mapped.x,
        y: mapped.y,
        modifiers: getModifiers(pendingMoveEvent),
      }));
    }
    pendingMoveEvent = null;
  });
};

// Cleanup in useEffect return:
return () => {
  if (rafId !== null) cancelAnimationFrame(rafId);
};
```

### Anti-Patterns to Avoid
- **Using naturalWidth/naturalHeight for coordinate mapping:** The `<img>` shows a screencast frame that is already scaled by CDP (maxWidth/maxHeight from ScreencastOptions). The image's naturalWidth/naturalHeight is the CDP-scaled frame size, NOT the browser viewport size. Use the `ViewportMessage` dimensions for mapping instead.
- **Creating a second WebSocket:** The `useBrowserStream` hook manages the WebSocket lifecycle. Input messages should go through the same connection.
- **Attaching listeners to the container div instead of the img:** The `<img>` element with `object-fit: contain` is what the user sees and clicks. Listeners should be on the img to get correct coordinates.
- **Using lodash throttle/debounce for mouse move:** Lodash throttle uses `setTimeout` with arbitrary delay, not aligned to frame rendering. rAF is the correct approach for UI-synchronized throttling.
- **Storing mapped coordinates in React state:** Mouse events fire at 30-120Hz. Using `useState` for coordinates causes unnecessary re-renders. Use refs and direct WebSocket sends instead.
- **Awaiting server response after sending input:** The server is fire-and-forget (Phase 11). Never wait for acknowledgment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket management | New WebSocket | Existing `useBrowserStream` hook wsRef | WebSocket lifecycle (connect, reconnect, visibility) already handled |
| Input message types | New type definitions | Existing `MouseInputMessage` from browser-stream/types.ts | Types already defined in Phase 10 |
| Server message routing | Client-side routing | Existing `handleInputMessage` on server | Phase 11 already handles routing |
| Multi-event sequence on server | Server-side click composition | Client-side 3-event sequence | Phase 11 explicitly does NOT compose sequences |

**Key insight:** Phase 12 is client-side only. The server infrastructure is complete. The new code lives entirely in `packages/playground-ui` with no server changes.

## Common Pitfalls

### Pitfall 1: Using Image naturalWidth Instead of Viewport Dimensions
**What goes wrong:** Coordinate mapping uses `img.naturalWidth`/`img.naturalHeight` instead of the viewport dimensions from `ViewportMessage`, producing incorrect coordinates.
**Why it happens:** The `<img>` element displays a CDP screencast frame that has been downscaled by CDP's `maxWidth`/`maxHeight` constraints (default 1280x720 from ScreencastOptions). The image naturalWidth might be 1280 even if the browser viewport is 1920. Using naturalWidth would map to the frame's pixel space, not the browser's viewport space.
**How to avoid:** Always use `viewport.width`/`viewport.height` from the `ViewportMessage` for the mapping denominator. The mapping formula is: `browserX = imageRelativeX / scale` where `scale = Math.min(elemWidth / viewport.width, elemHeight / viewport.height)`.
**Warning signs:** Clicks land at wrong positions, especially on high-DPI or non-default viewport sizes.

### Pitfall 2: Forgetting to Suppress Host contextmenu on Right-Click
**What goes wrong:** Right-clicking the live view opens the browser's native context menu instead of forwarding a right-click to the remote browser.
**Why it happens:** The `contextmenu` event fires on right-click by default. If not prevented, the host page shows its native context menu, and the click event may not fire at all.
**How to avoid:** Add `e.preventDefault()` on the `contextmenu` event listener attached to the `<img>` element. Then use the `mousedown`/`mouseup` events to detect right-clicks (event.button === 2) and forward them as CDP events with `button: 'right'`.
**Warning signs:** Native context menu appears on right-click; remote browser never receives right-click.

### Pitfall 3: Wheel Delta Not Normalized Across Browsers
**What goes wrong:** Scrolling works on Chrome but scrolls too slowly on Firefox or too fast on Safari.
**Why it happens:** Chrome reports wheel deltas in pixels (`deltaMode === 0`), Firefox on Windows/Linux uses lines (`deltaMode === 1`), and some devices report pages (`deltaMode === 2`). If you pass `event.deltaY` directly to CDP, the units are inconsistent.
**How to avoid:** Normalize all wheel deltas to pixels before sending to CDP. Multiply line-mode deltas by a line height constant (16-20px is standard). Multiply page-mode deltas by viewport height. Clamp the final value to prevent extreme jumps (e.g., max 500px per event).
**Warning signs:** Scroll speed drastically different between browsers; Firefox scrolls ~1 pixel per notch.

### Pitfall 4: mouseMoved Flooding WebSocket
**What goes wrong:** Every mouse movement over the frame sends a WebSocket message, potentially 60-120 times per second, overwhelming the server and CDP.
**Why it happens:** `mousemove` fires at the display refresh rate (or faster with pointer events). Without throttling, the WebSocket queue grows faster than the server can process.
**How to avoid:** Use rAF + delta-time gating to cap at ~30 events per second. Store the latest event in a ref and only process it when enough time has elapsed.
**Warning signs:** WebSocket readyState shows buffering; server logs show high CPU; mouse movement feels laggy due to event queue buildup.

### Pitfall 5: Event Listeners Not Cleaned Up on Unmount or Viewport Change
**What goes wrong:** Stale event listeners cause memory leaks or reference stale viewport dimensions.
**Why it happens:** `useEffect` cleanup not returning removal functions, or event listeners capturing stale closure values.
**How to avoid:** Store viewport in a ref (updated on each render) alongside the state version. Event handlers read from the ref. Always return cleanup from useEffect that removes all event listeners and cancels any pending rAF.
**Warning signs:** Console warnings about state updates on unmounted components; clicks map to wrong positions after viewport resize.

### Pitfall 6: Sending Events Before Viewport Is Known
**What goes wrong:** User clicks the frame before the first `ViewportMessage` arrives, sending invalid coordinates (division by zero or NaN).
**Why it happens:** There is a brief window between WebSocket connection and the first frame where viewport is null.
**How to avoid:** Check `viewport !== null` before processing any mouse event. If viewport is null, silently ignore the event. The guard is in the mouse interaction hook.
**Warning signs:** NaN coordinates sent to server; server validation rejects as `!isFinite()`.

### Pitfall 7: CDP mouseWheel Requires Both deltaX and deltaY
**What goes wrong:** CDP returns error `'deltaX' and 'deltaY' are expected for mouseWheel event`.
**Why it happens:** Unlike mousePressed/mouseReleased which have optional deltas, mouseWheel requires BOTH deltaX and deltaY to be present in the message.
**How to avoid:** Always include both `deltaX` and `deltaY` in mouseWheel messages, even if one is 0. Do NOT rely on optional fields or omit zero values.
**Warning signs:** Scroll events silently fail; console shows CDP errors about missing deltaX/deltaY.

## Code Examples

### Modifier Key Mapping (JS event to CDP bitmask)

```typescript
// Source: CDP Input domain documentation
// https://chromedevtools.github.io/devtools-protocol/tot/Input/

/**
 * Convert JavaScript MouseEvent/KeyboardEvent modifier properties
 * to CDP modifier bitmask.
 *
 * CDP bitmask: Alt=1, Ctrl=2, Meta/Command=4, Shift=8
 */
export function getModifiers(event: MouseEvent | KeyboardEvent): number {
  let modifiers = 0;
  if (event.altKey) modifiers |= 1;
  if (event.ctrlKey) modifiers |= 2;
  if (event.metaKey) modifiers |= 4;
  if (event.shiftKey) modifiers |= 8;
  return modifiers;
}
```

### Wheel Delta Normalization

```typescript
// Source: MDN WheelEvent.deltaMode documentation
// https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode

/** Approximate line height in pixels for deltaMode === 1 (DOM_DELTA_LINE) */
const LINE_HEIGHT_PX = 16;

/** Maximum delta per event to prevent extreme scroll jumps */
const MAX_DELTA = 500;

/**
 * Normalize a WheelEvent delta value to CSS pixels.
 * Handles cross-browser deltaMode differences:
 *   0 = DOM_DELTA_PIXEL (Chrome default)
 *   1 = DOM_DELTA_LINE (Firefox default on Windows/Linux)
 *   2 = DOM_DELTA_PAGE (rare, some trackpads)
 *
 * Result is clamped to [-MAX_DELTA, MAX_DELTA] to prevent extreme jumps.
 */
export function normalizeWheelDelta(delta: number, deltaMode: number, viewportHeight?: number): number {
  let pixels: number;

  switch (deltaMode) {
    case 0: // DOM_DELTA_PIXEL
      pixels = delta;
      break;
    case 1: // DOM_DELTA_LINE
      pixels = delta * LINE_HEIGHT_PX;
      break;
    case 2: // DOM_DELTA_PAGE
      pixels = delta * (viewportHeight ?? 800);
      break;
    default:
      pixels = delta;
  }

  // Clamp to prevent extreme jumps
  return Math.max(-MAX_DELTA, Math.min(MAX_DELTA, pixels));
}
```

### Complete Right-Click Forwarding Pattern

```typescript
// Source: MDN contextmenu event documentation
// https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event

// Suppress host context menu on the img element
const handleContextMenu = (e: Event) => {
  e.preventDefault();
};
imgElement.addEventListener('contextmenu', handleContextMenu);

// In mousedown/mouseup handlers, detect right-click via button property
const handleMouseDown = (e: MouseEvent) => {
  const mapped = mapClientToViewport(e.clientX, e.clientY, rect, viewport);
  if (!mapped) return;

  // Map JS button values to CDP button strings
  // JS: 0=left, 1=middle, 2=right
  // CDP: 'left', 'middle', 'right'
  const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
  const modifiers = getModifiers(e);

  // Send mouseMoved first (CDP requirement)
  sendMouseEvent('mouseMoved', mapped.x, mapped.y, undefined, undefined, modifiers);
  // Then mousePressed with correct button
  sendMouseEvent('mousePressed', mapped.x, mapped.y, button, 1, modifiers);
};

const handleMouseUp = (e: MouseEvent) => {
  const mapped = mapClientToViewport(e.clientX, e.clientY, rect, viewport);
  if (!mapped) return;

  const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
  sendMouseEvent('mouseReleased', mapped.x, mapped.y, button, 1, getModifiers(e));
};
```

### WebSocket Message Format Reference

All messages use the `MouseInputMessage` type from Phase 10 (`packages/deployer/src/server/browser-stream/types.ts`):

```typescript
// Click sequence (3 messages sent rapidly):
{ type: 'mouse', eventType: 'mouseMoved', x: 150, y: 300, modifiers: 0 }
{ type: 'mouse', eventType: 'mousePressed', x: 150, y: 300, button: 'left', clickCount: 1, modifiers: 0 }
{ type: 'mouse', eventType: 'mouseReleased', x: 150, y: 300, button: 'left', clickCount: 1, modifiers: 0 }

// Scroll (1 message):
{ type: 'mouse', eventType: 'mouseWheel', x: 150, y: 300, deltaX: 0, deltaY: 120, modifiers: 0 }

// Mouse move (throttled, ~30/sec):
{ type: 'mouse', eventType: 'mouseMoved', x: 200, y: 350, modifiers: 0 }

// Ctrl+click:
{ type: 'mouse', eventType: 'mouseMoved', x: 150, y: 300, modifiers: 2 }
{ type: 'mouse', eventType: 'mousePressed', x: 150, y: 300, button: 'left', clickCount: 1, modifiers: 2 }
{ type: 'mouse', eventType: 'mouseReleased', x: 150, y: 300, button: 'left', clickCount: 1, modifiers: 2 }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No client input | Coordinate-mapped mouse events | This phase | Enables click/scroll interaction with live view |
| ViewportMessage ignored by client | Parsed and used for mapping | This phase | Unlocks accurate coordinate translation |
| No wheel normalization | deltaMode-aware normalization | This phase | Cross-browser scroll consistency |

**Deprecated/outdated:**
- `mousewheel` (non-standard) and `DOMMouseScroll` (Firefox legacy) events: Use the standard `wheel` event instead. All modern browsers support it.
- `event.wheelDelta` / `event.detail`: Use `event.deltaY` with `event.deltaMode` instead.

## Open Questions

1. **Double-click support**
   - What we know: CDP supports `clickCount: 2` for double-clicks. The client could detect dblclick events.
   - What's unclear: Should Phase 12 handle double-clicks, or defer to a later phase?
   - Recommendation: Defer. Single clicks cover the critical path. Double-click can be added as an enhancement. The architecture supports it (just change `clickCount` to 2).

2. **Mouse cursor style changes**
   - What we know: When hovering over different elements in the remote browser, the cursor should ideally change (pointer for links, text for inputs, etc.).
   - What's unclear: CDP does not send cursor style information in the screencast frame. Implementing this would require listening to `Page.setCursor` CDP events.
   - Recommendation: Out of scope for Phase 12. The cursor will remain the default arrow/pointer. Phase 14 (Visual Feedback) could address cursor style if desired.

3. **Touch events / mobile simulation**
   - What we know: CDP has `Input.dispatchTouchEvent` and `Input.emulateTouchFromMouseEvent`. Some users may be on touch devices.
   - What's unclear: Whether touch-to-mouse translation is needed for mobile Studio users.
   - Recommendation: Out of scope. Phase 12 handles mouse events only. Touch can be a separate enhancement.

4. **High-DPI (devicePixelRatio) considerations**
   - What we know: `getBoundingClientRect()` returns CSS pixels regardless of devicePixelRatio. CDP coordinates are in CSS pixels. The mapping math should work correctly on retina displays without adjustment.
   - What's unclear: Whether any edge case exists where DPR affects the mapping.
   - Recommendation: No DPR adjustment needed. Both sides of the mapping operate in CSS pixels. Validate during testing on a retina display.

## Sources

### Primary (HIGH confidence)
- [CDP Input domain documentation](https://chromedevtools.github.io/devtools-protocol/tot/Input/) - dispatchMouseEvent parameters, modifier bitmask values, mouseWheel requirements
- [MDN WheelEvent.deltaMode](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode) - deltaMode values 0/1/2 and their meaning
- [MDN WheelEvent.deltaY](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY) - deltaY semantics
- [MDN Element.getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) - Returns CSS pixel rect including padding and border
- [MDN object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit) - contain behavior: letterbox/pillarbox with preserved aspect ratio
- [MDN contextmenu event](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event) - Right-click event, preventDefault suppresses native menu
- Codebase verification: `packages/deployer/src/server/browser-stream/types.ts` - MouseInputMessage, ViewportMessage types
- Codebase verification: `packages/deployer/src/server/browser-stream/input-handler.ts` - Server routing (fire-and-forget)
- Codebase verification: `packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts` - WebSocket hook (no viewport parsing yet)
- Codebase verification: `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx` - Current img rendering with object-contain
- Codebase verification: `integrations/agent-browser/src/screencast/types.ts` - ScreencastFrameData.viewport shape

### Secondary (MEDIUM confidence)
- [chromedp/chromedp mouseWheel issue #491](https://github.com/chromedp/chromedp/issues/491) - Confirms both deltaX and deltaY required for mouseWheel events
- [Ben Nadel: Translating Viewport Coordinates](https://www.bennadel.com/blog/3441-translating-viewport-coordinates-into-element-local-coordinates-using-element-getboundingclientrect.htm) - getBoundingClientRect coordinate mapping approach
- [get-object-fit-rect utility](https://github.com/erhangundogan/get-object-fit-rect) - Validates the manual calculation approach for object-fit: contain
- [Nolan Lawson: High-performance input handling](https://nolanlawson.com/2019/08/11/high-performance-input-handling-on-the-web/) - rAF throttling for input events
- [Motion.dev: When browsers throttle rAF](https://motion.dev/blog/when-browsers-throttle-requestanimationframe) - rAF behavior on background tabs

### Tertiary (LOW confidence)
- [Mozilla Bug 1057252](https://bugzilla.mozilla.org/show_bug.cgi?id=1057252) - Firefox uses deltaMode=1 (lines) by default, confirming cross-browser normalization need

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; all browser-native APIs verified via MDN
- Architecture: HIGH - Extends existing verified codebase patterns (hooks, components, WebSocket); coordinate math derived from CSS specification
- Coordinate mapping: HIGH - Pure math from object-fit: contain spec, verified against multiple sources and utility libraries
- Wheel normalization: HIGH - deltaMode values verified via MDN; cross-browser differences documented in Mozilla bug tracker
- Modifier mapping: HIGH - CDP bitmask values verified via official CDP documentation
- Pitfalls: HIGH - All pitfalls derived from verified API behavior and codebase review
- Throttling pattern: MEDIUM - rAF + delta-time is well-established but 30fps target is a design choice (could be tuned)

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (stable domain, browser APIs and CDP are well-established, 30-day validity)
