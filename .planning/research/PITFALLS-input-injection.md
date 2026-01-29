# Domain Pitfalls: Browser Input Injection via CDP

**Domain:** User input injection through live view panel into browser via CDP
**Context:** Adding click, type, and scroll injection to existing screencast live view (v1.2 milestone)
**Researched:** 2026-01-28
**Confidence:** HIGH (CDP official docs, Chromium bug tracker, Puppeteer/Playwright community issues, noVNC scaling patterns)

---

## Critical Pitfalls

Mistakes that cause input to land on wrong elements, corrupt browser state, or create unusable interaction.

---

### Pitfall 1: Coordinate Mapping Off-By-Growing-Error on Scaled Frames

**What goes wrong:** User clicks on the live view image (displayed smaller than the 1280x720 viewport). The click coordinates are mapped to viewport coordinates, but the mapping is wrong. Clicks near the top-left corner are almost correct, but error grows toward the bottom-right corner until clicks in the far corner are completely off-target.

**Why it happens:** The displayed `<img>` element has CSS dimensions that differ from the actual viewport dimensions in the browser. The most common mistake is using only one scale factor (e.g., `imageWidth / viewportWidth`) when the aspect ratio between the displayed image and the viewport does not match exactly. CSS `object-fit: contain` can introduce letterboxing (black bars) that are part of the element's bounding rect but not part of the image content, causing additional offset.

**Concrete scenario in this codebase:**
- Screencast defaults to maxWidth: 1280, maxHeight: 720 (from `SCREENCAST_DEFAULTS`)
- The `<img>` is rendered in a panel that may be 640x360 or any arbitrary size
- If the panel has a different aspect ratio (e.g., 640x400), `object-fit: contain` adds 20px padding at top and bottom
- A click at panel coordinate (320, 380) should map to viewport (640, 720) but without accounting for letterbox offset, it maps to viewport (640, 760) -- 40px off, potentially clicking the wrong element or outside the viewport entirely

**The correct coordinate mapping formula:**
```typescript
// 1. Get the rendered image dimensions (not the CSS container)
//    This accounts for object-fit letterboxing
const imgRect = imgElement.getBoundingClientRect();
const naturalWidth = imgElement.naturalWidth;   // CDP frame width
const naturalHeight = imgElement.naturalHeight; // CDP frame height

// 2. Calculate the actual rendered image area within the element
//    (object-fit: contain may leave letterbox gaps)
const imgAspect = naturalWidth / naturalHeight;
const elemAspect = imgRect.width / imgRect.height;

let renderWidth: number, renderHeight: number;
let offsetX: number, offsetY: number;

if (imgAspect > elemAspect) {
  // Image is wider than container: horizontal fit, vertical letterbox
  renderWidth = imgRect.width;
  renderHeight = imgRect.width / imgAspect;
  offsetX = 0;
  offsetY = (imgRect.height - renderHeight) / 2;
} else {
  // Image is taller than container: vertical fit, horizontal letterbox
  renderHeight = imgRect.height;
  renderWidth = imgRect.height * imgAspect;
  offsetX = (imgRect.width - renderWidth) / 2;
  offsetY = 0;
}

// 3. Map click coordinates (relative to element) to viewport coordinates
const clickX = event.clientX - imgRect.left;
const clickY = event.clientY - imgRect.top;

// 4. Subtract letterbox offset, then scale to viewport
const viewportX = ((clickX - offsetX) / renderWidth) * naturalWidth;
const viewportY = ((clickY - offsetY) / renderHeight) * naturalHeight;

// 5. Account for CDP screencast metadata
//    The frame metadata contains pageScaleFactor (pinch zoom)
//    and offsetTop (browser chrome offset in DIP)
const finalX = viewportX / frame.viewport.pageScaleFactor;
const finalY = (viewportY - frame.viewport.offsetTop) / frame.viewport.pageScaleFactor;
```

**Warning signs:**
- Clicks near corners miss targets more than clicks near center
- Manual testing only near center appears to work, then users report misses
- QA passes on one screen size but fails on another

**Prevention:**
1. Compute separate X and Y offsets accounting for letterboxing (do NOT assume the image fills the element)
2. Use `naturalWidth` / `naturalHeight` from the `<img>` element (or the viewport metadata from the frame) as the target coordinate space
3. Validate with a visual debug overlay: draw a dot at the computed viewport coordinate on the frame to confirm mapping
4. Test at multiple panel sizes, especially non-matching aspect ratios
5. Reject clicks that map outside the viewport bounds (0..width, 0..height)

**Phase to address:** First phase of input injection -- this is foundational to all mouse interaction.

**Sources:**
- [CDP Input.dispatchMouseEvent](https://chromedevtools.github.io/devtools-protocol/tot/Input/) -- coordinates are in CSS pixels relative to viewport
- [Chromium issue #40248189](https://issues.chromium.org/issues/40248189) -- dispatchMouseEvent not accounting for emulation scale
- [noVNC scaling issue #12](https://github.com/novnc/noVNC/issues/12) -- CSS scaling breaks mouse coordinates
- [noVNC position drift issue #258](https://github.com/novnc/noVNC/issues/258) -- error grows toward bottom-right

---

### Pitfall 2: CDP Click Silently Fails (No Error, No Effect)

**What goes wrong:** `Input.dispatchMouseEvent` is called with `type: "mousePressed"` and `type: "mouseReleased"`, but nothing happens on the page. No error is returned. The click is silently swallowed.

**Why it happens:** The CDP `Input.dispatchMouseEvent` has default values that cause silent failures:
- `button` defaults to `"none"` -- dispatches a buttonless mouse event that no click handler responds to
- `clickCount` defaults to `0` -- the browser does not synthesize a `click` event from mousedown/mouseup when clickCount is 0
- Missing `mouseMoved` before `mousePressed` -- some elements require a hover event first to become interactive (CSS `:hover` state, JavaScript mouseover handlers)

**The correct click sequence:**
```typescript
// Step 1: Move mouse to target (triggers hover, mouseenter, mouseover)
await cdpSession.send('Input.dispatchMouseEvent', {
  type: 'mouseMoved',
  x: targetX,
  y: targetY,
  // button defaults to 'none' -- correct for move
});

// Step 2: Press mouse button
await cdpSession.send('Input.dispatchMouseEvent', {
  type: 'mousePressed',
  x: targetX,
  y: targetY,
  button: 'left',       // REQUIRED: default 'none' causes silent failure
  clickCount: 1,         // REQUIRED: default 0 prevents click event synthesis
  buttons: 1,            // Left button bitmask
});

// Step 3: Release mouse button
await cdpSession.send('Input.dispatchMouseEvent', {
  type: 'mouseReleased',
  x: targetX,
  y: targetY,
  button: 'left',       // Must match press
  clickCount: 1,         // Must match press
});
```

**What happens if you skip steps:**
| Omission | Symptom |
|----------|---------|
| No `mouseMoved` first | Dropdown menus, tooltips, hover-dependent UI never activate |
| `button: 'none'` (default) | mousedown fires but no click event synthesized |
| `clickCount: 0` (default) | mousedown + mouseup fire but browser does not synthesize click |
| Only `mousePressed`, no `mouseReleased` | mousedown fires, mouseup and click never fire; can cause mousePressed to **hang** (blocks the CDP call) if the press triggers navigation |
| `mousePressed` and `mouseReleased` at different coordinates | Interpreted as drag, not click |

**Warning signs:**
- Click handler works in Playwright/Puppeteer high-level API but not via raw CDP
- Click seems to do nothing, no error is thrown
- Dropdown menus never open despite clicking their trigger
- Form submissions don't fire despite clicking submit button

**Prevention:**
1. Always send the 3-event sequence: `mouseMoved` -> `mousePressed` -> `mouseReleased`
2. Always set `button: 'left'` and `clickCount: 1` explicitly -- never rely on defaults
3. Send both `mousePressed` and `mouseReleased` at identical coordinates for a click
4. Add a small delay (10-50ms) between pressed and released to mimic human timing
5. For right-click: use `button: 'right'`, `buttons: 2`

**Phase to address:** First phase -- the inject mouse event handler must implement this correctly.

**Sources:**
- [CDP Input domain specification](https://chromedevtools.github.io/devtools-protocol/tot/Input/) -- parameter defaults documented
- [chromote issue #30](https://github.com/rstudio/chromote/issues/30) -- dispatchMouseEvent hanging when button omitted
- [chrome-debugging-protocol discussion](https://groups.google.com/g/google-chrome-developer-tools/c/m1F9y6vAWjI) -- click event not firing
- [Automating clicks in Chromium](https://medium.com/@aslushnikov/automating-clicks-in-chromium-a50e7f01d3fb) -- correct event sequence

---

### Pitfall 3: Race Condition Between User Input and Agent Tool Calls

**What goes wrong:** User clicks on the live view to solve a CAPTCHA while the agent is simultaneously executing a tool call (e.g., `browser_click` or `browser_navigate`). Both actions try to interact with the page at the same time. Results are unpredictable: agent clicks wrong element because page state changed, user click lands on a page the agent just navigated away from, or the agent's Playwright locator becomes stale mid-action.

**Why it happens:** The existing codebase has no coordination mechanism between:
1. User input injection via `BrowserToolset.injectMouseEvent()` (CDP `Input.dispatchMouseEvent`)
2. Agent tool execution via `browser_click`, `browser_type`, etc. (Playwright locator-based actions)

Both paths ultimately interact with the same page. Playwright's `locator.click()` calls involve multiple steps (scroll into view, check actionability, calculate coordinates, dispatch events) that are **not atomic**. If a user injects a click between Playwright's "check actionability" and "dispatch click," the page state may change.

**Concrete race scenarios:**

| Scenario | User Action | Agent Action | Outcome |
|----------|-------------|--------------|---------|
| Navigation race | User clicks a link | Agent calls `browser_navigate` | User click triggers navigation, agent navigate fails or navigates away from user's target |
| Element invalidation | User clicks CAPTCHA checkbox | Agent calls `browser_snapshot` then `browser_click` on ref | User solves CAPTCHA, page updates, agent's ref is now stale |
| Focus conflict | User clicks an input field | Agent calls `browser_type` on a different field | Focus jumps between fields, text goes to wrong input |
| Scroll interference | User scrolls down | Agent clicks element that was in view | Element scrolls out of view, agent click misses or hits wrong element |
| Double action | User clicks "Submit" | Agent clicks "Submit" | Form submitted twice, potential duplicate data |

**Warning signs:**
- Intermittent test failures when user and agent interact simultaneously
- "stale_ref" errors spike when users are actively interacting
- Agent reports "element not found" or "element blocked" unexpectedly
- User sees page flash/jump during their interaction

**Prevention:**
1. **Input lock with state machine:** Implement a state machine that tracks who has control:
   ```
   States: IDLE -> AGENT_ACTIVE -> USER_ACTIVE -> IDLE
   - AGENT_ACTIVE: Agent tool call in progress, queue user input
   - USER_ACTIVE: User is interacting, signal agent to pause
   ```
2. **Queue user input during agent tool execution:** When agent is mid-tool-call, buffer user input events and replay them after the tool call completes
3. **Short debounce window on user input:** After user input, set a brief "user is active" window (e.g., 2 seconds of no input) during which agent tool calls are held
4. **Notify agent of page changes:** After user input, trigger a mechanism that tells the agent "page state has changed, take a fresh snapshot before acting"
5. **At minimum: document the limitation.** If full locking is deferred, clearly document that user should not interact while agent is executing a tool call

**Phase to address:** This must be addressed in the same phase as input injection. Even a simple "agent busy" indicator that prevents user clicks during tool execution is better than uncoordinated access.

**Sources:**
- [Browser-use concurrent operation issues](https://github.com/browser-use/browser-use/issues/2575)
- [Playwright race condition patterns](https://github.com/microsoft/playwright/issues/3912)
- [CDP dispatchMouseEvent returns too early](https://bugzilla.mozilla.org/show_bug.cgi?id=1740798)

---

### Pitfall 4: Stale Frame Coordinate Mismatch (Clicking Ghost Elements)

**What goes wrong:** User sees a JPEG frame from 500ms-2s ago. They click on a button visible in that frame. But the page has changed since the frame was captured -- the button has moved, been removed, or the page has scrolled. The click lands on whatever is currently at those coordinates in the actual (invisible-to-user) browser state, which may be a completely different element.

**Why it happens:** The live view displays a sequence of JPEG snapshots from CDP screencast. Between frame captures, JavaScript execution, animations, auto-scrolling, network-triggered content updates, and agent tool calls can all change the page. The user has no way to know the frame is stale because:
- Screencast frame rate is low (1-5 FPS effective in headless Chrome)
- Network latency adds delay
- The frame is a static image -- no DOM, no hover feedback, no animations

**Concrete scenario:**
1. Frame at T=0ms shows a "Submit" button at coordinates (400, 300)
2. JavaScript animation slides the form down by 100px at T=200ms
3. User sees the old frame and clicks where "Submit" was: (400, 300)
4. Click arrives at T=500ms, but "Submit" is now at (400, 400)
5. User accidentally clicks the "Cancel" button that slid into position (400, 300)

**How this differs from existing v1.0 toolset:** The existing agent tools (browser_click, browser_type) use Playwright locators with refs (@e1, @e2) from accessibility snapshots. Playwright re-checks element position before clicking. User input injection goes directly to CDP coordinates -- there is no re-check or ref-based targeting.

**Warning signs:**
- Users report clicks "don't do what they expected"
- Higher error rate on dynamic/animated pages vs static pages
- Users instinctively try to click rapidly multiple times (retry pattern)
- User complaints about "laggy" interaction that is actually stale-frame, not slow-response

**Prevention:**
1. **Freshness indicator:** Display frame age. If the frame is older than a threshold (e.g., 1 second), show a warning or dim the overlay
2. **Request fresh frame before injecting:** When user clicks, request a new screencast frame and show a brief "targeting..." state before dispatching the click
3. **Visual confirmation:** After injecting a click, show a visual marker at the click coordinates on the NEXT frame received, confirming where the click actually landed
4. **Frame timestamp comparison:** Store the frame timestamp with each click event. If the frame is older than 500ms, warn or require confirmation
5. **Mouse move tracking:** As user moves mouse over the frame, continuously send `mouseMoved` events to the browser. This means the browser cursor is already at the right position when the user clicks, reducing the stale-frame problem for hover-dependent elements

**Phase to address:** Address in the first input injection phase with at least a basic freshness indicator. The visual confirmation feedback should follow in a subsequent phase.

**Sources:**
- [noVNC stale frame / low FPS issue #221](https://github.com/novnc/noVNC/issues/221) -- framerate drops without mouse movement
- [Latency testing remote browsing](https://thume.ca/2022/05/15/latency-testing-streaming/) -- fundamental display streaming latency analysis

---

## Moderate Pitfalls

Mistakes that cause degraded user experience or confusing behavior.

---

### Pitfall 5: Keyboard Event Dispatch Missing the `char` Event Type

**What goes wrong:** User types on their keyboard. Key events are forwarded to the browser via CDP `Input.dispatchKeyEvent`. Characters appear in the focused input field on some pages but not others. Modifier keys (Shift, Ctrl) have no effect.

**Why it happens:** CDP keyboard events require a specific 3-event sequence for text input, and the `text` parameter must only be set on the `char` event type. Common mistakes:

1. **Sending only `keyDown` and `keyUp`** -- this fires the DOM `keydown` and `keyup` events but does NOT insert text. The `char` event type is what triggers text insertion.
2. **Setting `text` on `keyDown`** -- this is ignored. The `text` field is only processed on `char` and `keyUp` event types.
3. **Confusing `key` vs `code`** -- `key` is the semantic meaning ("a", "Shift"), `code` is the physical key ("KeyA", "ShiftLeft"). Using `key: "a"` but `code: "keya"` fails because codes are case-sensitive (`KeyA` not `keyA`).
4. **Modifiers bitmask incorrect** -- the modifiers field is a bitmask (Alt=1, Ctrl=2, Meta/Command=4, Shift=8), not an enum. Sending `modifiers: "shift"` instead of `modifiers: 8` silently fails.
5. **Missing `windowsVirtualKeyCode`** -- some pages check `event.keyCode` which is derived from this field. Without it, `keyCode` is 0, breaking legacy event handlers.

**The correct key event sequence for typing "A" (uppercase):**
```typescript
// For character input: keyDown -> char -> keyUp
// For modifier keys (Shift, Ctrl): keyDown -> keyUp (no char)

// 1. Press Shift
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Shift',
  code: 'ShiftLeft',
  modifiers: 8,  // Shift bit
  windowsVirtualKeyCode: 16,
});

// 2. Press 'a' key (with Shift modifier)
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'A',
  code: 'KeyA',
  modifiers: 8,
  windowsVirtualKeyCode: 65,
});

// 3. Insert character (this is what actually types)
await cdp.send('Input.dispatchKeyEvent', {
  type: 'char',
  text: 'A',
  unmodifiedText: 'a',  // What would be typed without Shift
  modifiers: 8,
});

// 4. Release 'a' key
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'A',
  code: 'KeyA',
  modifiers: 8,
  windowsVirtualKeyCode: 65,
});

// 5. Release Shift
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'Shift',
  code: 'ShiftLeft',
  modifiers: 0,  // Shift no longer held
  windowsVirtualKeyCode: 16,
});
```

**For simple character input (lowercase, no modifiers), the practical approach:**
```typescript
// Simplified: for printable characters, send just char event
// This works for most text input scenarios
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'a',
  code: 'KeyA',
  windowsVirtualKeyCode: 65,
});
await cdp.send('Input.dispatchKeyEvent', {
  type: 'char',
  text: 'a',
});
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'a',
  code: 'KeyA',
  windowsVirtualKeyCode: 65,
});
```

**For special keys (Enter, Tab, Escape, Backspace):**
```typescript
// No 'char' event -- just keyDown and keyUp
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Enter',
  code: 'Enter',
  windowsVirtualKeyCode: 13,
});
await cdp.send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'Enter',
  code: 'Enter',
  windowsVirtualKeyCode: 13,
});
```

**Warning signs:**
- Text appears in some input fields but not others
- Shift+key produces lowercase instead of uppercase
- Enter key doesn't submit forms
- Backspace doesn't delete characters
- Copy/paste keyboard shortcuts don't work

**Prevention:**
1. Map browser `KeyboardEvent` properties correctly: `event.key` -> CDP `key`, `event.code` -> CDP `code`
2. Always send the 3-event sequence (keyDown, char, keyUp) for printable characters
3. Only send keyDown and keyUp for modifier and special keys
4. Maintain modifier state: track which modifiers are currently held to compute the bitmask
5. Set `windowsVirtualKeyCode` for common keys -- many sites rely on `event.keyCode`

**Phase to address:** Input injection phase -- keyboard handling.

**Sources:**
- [CDP Input.dispatchKeyEvent specification](https://chromedevtools.github.io/devtools-protocol/tot/Input/)
- [devtools-protocol issue #74](https://github.com/ChromeDevTools/devtools-protocol/issues/74) -- modifiers not working
- [devtools-protocol issue #45](https://github.com/ChromeDevTools/devtools-protocol/issues/45) -- sending Enter key event
- [mafredri/cdp issue #52](https://github.com/mafredri/cdp/issues/52) -- dispatchKeyEvent examples
- [chrome-debugging-protocol discussion](https://groups.google.com/g/chrome-debugging-protocol/c/sYsatMpk9_I) -- typing into input fields via CDP

---

### Pitfall 6: Mouse Event Flood from mousemove Overwhelming CDP

**What goes wrong:** User moves their mouse over the live view frame. Every `mousemove` event from the browser is forwarded to the server via WebSocket, which dispatches `Input.dispatchMouseEvent` with type `mouseMoved` to CDP. At 60+ events per second, this overwhelms the WebSocket, the server, and CDP, causing lag in all browser interactions including the agent's tool calls.

**Why it happens:** The browser fires `mousemove` events at display refresh rate (60Hz or higher). Without throttling, each event generates: browser event -> WebSocket message -> server handler -> CDP call -> browser processing. This creates a pipeline of 60+ round trips per second for a zero-value interaction (mouse position tracking).

**Consequences:**
- WebSocket message queue backs up, causing frame delivery delays
- CDP command queue congestion delays agent tool calls
- Server CPU usage spikes from message processing
- Browser becomes sluggish due to constant CDP input processing
- On slow connections, mousemove events accumulate and play back in a burst, moving the cursor to outdated positions

**Warning signs:**
- Live view becomes noticeably laggy when user moves mouse
- Agent tool calls take longer when user is hovering over the frame
- WebSocket `bufferedAmount` grows continuously
- Server CPU usage correlates with mouse movement

**Prevention:**
1. **Throttle mousemove events on the client:** Maximum 10-20 events per second is sufficient for smooth tracking
   ```typescript
   let lastMoveTime = 0;
   const MOVE_THROTTLE_MS = 50; // 20 events/sec max

   imgElement.addEventListener('mousemove', (e) => {
     const now = Date.now();
     if (now - lastMoveTime < MOVE_THROTTLE_MS) return;
     lastMoveTime = now;
     sendMouseEvent('mouseMoved', e);
   });
   ```
2. **Consider NOT sending mousemove at all initially:** Mouse hover is a nice-to-have. Start with only click events (mousePressed + mouseReleased). Add mousemove support only if hover-dependent interactions are needed.
3. **Use `requestAnimationFrame` for batching:** Only send the latest mouse position per animation frame
4. **Monitor WebSocket backpressure:** If `ws.bufferedAmount` exceeds a threshold, drop mousemove events (keep click events)

**Phase to address:** Input injection phase -- implement throttling from the start, or defer mousemove entirely to a later phase.

---

### Pitfall 7: Scroll Injection Produces No Visible Effect or Infinite Scroll

**What goes wrong:** User scrolls their mouse wheel over the live view. Scroll events are forwarded to the browser. Either nothing happens (scroll doesn't take effect) or the page scrolls uncontrollably (accumulated scroll events fire in sequence).

**Why it happens:** CDP `Input.dispatchMouseEvent` with `type: 'mouseWheel'` requires `deltaX` and `deltaY` values, but the mapping between browser wheel events and CDP wheel events is not 1:1.

Common mistakes:
1. **Using raw `event.deltaY` without normalizing:** Different browsers and operating systems report dramatically different `deltaY` values for the same physical scroll. Chrome on macOS reports pixels (e.g., -120), Firefox reports lines (e.g., -3), and some touchpads report sub-pixel values
2. **Not accounting for `deltaMode`:** `WheelEvent.deltaMode` can be 0 (pixels), 1 (lines), or 2 (pages). Forwarding the raw value without mode conversion causes wildly different behavior across browsers
3. **Accumulating queued scroll events:** If scroll events queue during a slow frame update, they all fire at once when the connection catches up, causing a massive scroll jump
4. **CDP scroll requires coordinates:** Unlike the existing `browser_scroll` tool which uses `window.scrollBy()`, CDP `mouseWheel` events need x,y coordinates to specify WHERE the scroll happens (affects which element receives the scroll)

**Warning signs:**
- Scroll works on some user machines but not others
- Scroll is extremely fast or extremely slow depending on the browser
- Page scrolls smoothly, then suddenly jumps
- Scrolling works on the main page but not inside scrollable containers

**Prevention:**
1. **Normalize deltaY to pixels:** Convert all scroll modes to pixel values before forwarding
   ```typescript
   function normalizeDelta(event: WheelEvent): { deltaX: number; deltaY: number } {
     let { deltaX, deltaY } = event;
     // Normalize line/page mode to pixels
     if (event.deltaMode === 1) { // Lines
       deltaX *= 40; // Standard line height
       deltaY *= 40;
     } else if (event.deltaMode === 2) { // Pages
       deltaX *= 800;
       deltaY *= 600;
     }
     // Clamp to reasonable range
     deltaX = Math.max(-300, Math.min(300, deltaX));
     deltaY = Math.max(-300, Math.min(300, deltaY));
     return { deltaX, deltaY };
   }
   ```
2. **Throttle scroll events:** Similar to mousemove, limit to 10-15 events per second
3. **Send scroll position as the current mouse coordinate:** Use the mapped viewport coordinates of where the user's cursor is on the frame
4. **Consider using the existing `browser_scroll` tool pattern** as a fallback: If CDP mouseWheel proves unreliable, evaluate using `window.scrollBy()` instead

**Phase to address:** Input injection phase -- scroll handling.

---

### Pitfall 8: Visual Feedback Gap (No Cursor, No Click Indicator, No Input Focus Indicator)

**What goes wrong:** User clicks on the live view, the click is dispatched to the browser, but there is no immediate visual feedback. The user sees a static JPEG image that doesn't change until the next screencast frame arrives (potentially 200ms-1s later). The user has no idea if their click was registered, where it landed, or what happened.

**Why it happens:** The live view displays JPEG snapshots, not a live DOM. There is no:
- Cursor visible in the frame (CDP screencast does not include cursor by default in headless mode)
- Button hover/press state feedback (the image doesn't change on hover)
- Text cursor (caret) visible in input fields
- Click animation or ripple effect

This is fundamentally different from a native browser where every interaction has immediate visual feedback through CSS hover states, focus rings, and cursor changes.

**Consequences:**
- Users double-click because they don't know their first click worked
- Users click the wrong spot because they can't see where the cursor is
- Users don't know which input field has focus for keyboard input
- The experience feels "broken" or "laggy" even when it's working correctly
- Users cannot tell the difference between "click was dispatched but hasn't taken effect yet" and "click was lost"

**Warning signs:**
- User feedback: "it doesn't respond to my clicks"
- Users repeatedly clicking the same spot
- Users reporting "lag" that is actually lack of feedback
- Users typing but not seeing text because they don't know which field has focus

**Prevention:**
1. **Client-side click indicator:** Immediately draw a visual marker (dot, ripple, crosshair) on the frame at the click position using a CSS overlay or canvas layer
   ```typescript
   // Draw click indicator on overlay canvas/div positioned over the image
   function showClickIndicator(x: number, y: number) {
     const indicator = document.createElement('div');
     indicator.className = 'click-indicator'; // animated dot/ripple
     indicator.style.left = `${x}px`;
     indicator.style.top = `${y}px`;
     overlayContainer.appendChild(indicator);
     setTimeout(() => indicator.remove(), 500);
   }
   ```
2. **Client-side cursor overlay:** Render a custom cursor element that follows the user's mouse position over the image, providing immediate feedback about where their cursor is
3. **Frame staleness indicator:** Show how old the current frame is (e.g., a small "200ms ago" badge) so users understand the delay
4. **Active input indicator:** When the user starts typing, show a small overlay near where they last clicked indicating "keyboard input active"
5. **State feedback on next frame:** After a click, compare the next frame to the previous one. If there's a visible change near the click area, briefly highlight it

**Phase to address:** First input injection phase should include at minimum a click indicator overlay. Cursor overlay can follow in a polish phase.

**Sources:**
- [Chrome Remote Desktop cursor alignment bug](https://support.google.com/chrome/thread/40848321/cursor-alignment-bug-in-chrome-remote-desktop?hl=en)
- [Latency testing remote browsing](https://thume.ca/2022/05/15/latency-testing-streaming/) -- local cursor overlay as standard technique
- [Remote desktop cursor best practices](https://blog.oudel.com/how-to-fix-the-mouse-cursor-on-remote-desktop/)

---

### Pitfall 9: No Focus Management Before Keyboard Input

**What goes wrong:** User starts typing on their keyboard. The key events are dispatched to CDP, but no input field has focus. The keystrokes are either lost entirely or get captured by a global keyboard handler (triggering keyboard shortcuts, scrolling the page, etc.) instead of entering text.

**Why it happens:** Unlike the existing `browser_type` tool which explicitly focuses an element via `locator.focus()` before typing, raw CDP keyboard events go to whatever element currently has focus. If the user hasn't clicked on an input field first (or if their click didn't focus the right element), the keyboard events have nowhere to go.

**Concrete scenarios:**
1. User opens live view and starts typing without clicking first -- keystrokes go to `document.body`, potentially triggering shortcuts (e.g., "d" bookmarks the page, "/" opens search)
2. User clicks an input field, but the click was on a stale frame and actually focused a different element
3. User clicks an input field, types some text, then the page updates and focus is lost (e.g., a modal opens)
4. Agent navigates to a new page while user was typing, focus is lost

**Warning signs:**
- User reports "typing does nothing"
- Page scrolls or triggers actions when user types
- Text appears in the wrong input field
- Browser keyboard shortcuts activate unexpectedly

**Prevention:**
1. **Require click before type:** Only enable keyboard event forwarding after a user clicks on the frame. Show visual state indicating "keyboard input active"
2. **Click-to-focus pattern:** When the user clicks on the frame, the click should focus the element at those coordinates. Then keyboard events go to the focused element
3. **Focus indicator overlay:** Show which element currently has focus (if detectable), so the user knows where their keystrokes will go
4. **Keyboard capture toggle:** Provide an explicit "type mode" toggle or detect when the user clicks a text-like area, enabling keyboard forwarding only in that context
5. **Escape hatch:** Define a key (e.g., Escape) that always stops keyboard forwarding and returns focus to the host page, so users don't get "trapped" in keyboard forwarding mode

**Phase to address:** Input injection phase -- keyboard handling must have focus management.

---

## Minor Pitfalls

Mistakes that cause annoyance but have straightforward fixes.

---

### Pitfall 10: Browser Context Menu on Right-Click Instead of Forwarding

**What goes wrong:** User right-clicks on the live view intending to trigger a context menu in the remote browser. Instead, the host browser's own context menu appears.

**Why it happens:** The default browser behavior for right-click on an `<img>` element shows the browser's context menu ("Save image as...", "Copy image", etc.). Without `event.preventDefault()`, the event is consumed by the host browser and never forwarded.

**Prevention:**
```typescript
imgElement.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // Prevent host browser context menu
  // Forward as right-click to CDP
  sendMouseEvent('mousePressed', e, { button: 'right' });
});
```

**Phase to address:** Input injection phase -- event handler setup.

---

### Pitfall 11: Keyboard Events Captured by Host Page Instead of Live View

**What goes wrong:** User presses keys intending to type in the remote browser. The keystrokes are captured by the host page's own event handlers (Studio UI), triggering Studio keyboard shortcuts, navigating the host page, or being consumed by other React components.

**Why it happens:** Without proper event capture and propagation control, keyboard events bubble up from the live view component through the React component tree to the host page. The host page may have its own keyboard handlers (e.g., Ctrl+K for command palette, arrow keys for navigation).

**Prevention:**
1. **Stop propagation on captured keys:**
   ```typescript
   frameContainer.addEventListener('keydown', (e) => {
     if (isKeyboardForwardingActive) {
       e.stopPropagation();
       e.preventDefault();
       sendKeyEvent(e);
     }
   }, { capture: true });
   ```
2. **Selective forwarding:** Only capture keys when the live view has focus (user clicked on the frame)
3. **Escape hatch:** Always let Escape key through to the host page to exit keyboard forwarding mode
4. **Tab key handling:** Decide explicitly whether Tab forwards to the remote browser (next input field) or exits the live view (next host UI element)

**Phase to address:** Input injection phase -- keyboard handling.

---

### Pitfall 12: dispatchMouseEvent Hanging on Navigation-Triggering Clicks

**What goes wrong:** User clicks a link in the live view. The `mousePressed` CDP call is dispatched. The link triggers a navigation. The page is torn down during navigation, but the `mouseReleased` call is still pending. The `mousePressed` call may hang or return a "Target closed" error.

**Why it happens:** CDP's `Input.dispatchMouseEvent` with `type: 'mousePressed'` on a link triggers navigation. The navigation destroys the execution context before `mouseReleased` can be dispatched. In some CDP implementations, the `mousePressed` call itself blocks waiting for the event to be processed, and if the page navigates away during processing, the call hangs.

**Prevention:**
1. **Fire-and-forget for mouseReleased:** Don't await the `mouseReleased` call, or wrap it in a catch that ignores "Target closed" errors
   ```typescript
   await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ... });
   // Don't await -- navigation may destroy context
   cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ... }).catch(() => {
     // Ignore "Target closed" -- expected on navigation
   });
   ```
2. **Set a timeout on the mousePressed call:** If it doesn't resolve within 5 seconds, assume navigation occurred
3. **Listen for page navigation events:** If `Page.frameNavigated` fires between pressed and released, skip the released event

**Phase to address:** Input injection phase -- click handling robustness.

**Sources:**
- [chromote issue #30](https://github.com/rstudio/chromote/issues/30) -- dispatchMouseEvent hanging
- [webdriverio issue #7988](https://github.com/webdriverio/webdriverio/issues/7988) -- "Target closed" error on dispatchMouseEvent
- [bugzilla #1740798](https://bugzilla.mozilla.org/show_bug.cgi?id=1740798) -- dispatchMouseEvent returns too early

---

### Pitfall 13: Double Cursor Confusion (CDP Cursor vs User Cursor)

**What goes wrong:** When using CDP `Input.dispatchMouseEvent` with `mouseMoved`, the browser may render a cursor at the CDP-specified position (visible in the screencast frame). The user also sees their own local cursor on the host page. This creates two cursors: one moving instantly (local) and one trailing behind in the JPEG stream (remote). Users become confused about which cursor represents their actual interaction position.

**Why it happens:** CDP's `mouseMoved` events update the browser's internal cursor position, which may be rendered in the screencast frame. The host browser cursor is always visible on top. This is the same "dual cursor" problem documented in all remote desktop solutions.

**Prevention:**
1. **Do not show CDP cursor in frames:** In headless mode, there is no visible cursor in screencast frames (this is the default, and a good thing). Do not try to enable cursor rendering
2. **Custom cursor overlay:** Replace the default cursor over the live view with a custom CSS cursor that visually distinguishes "live view interaction cursor" from normal cursor
   ```css
   .live-view-frame { cursor: crosshair; }
   .live-view-frame.keyboard-active { cursor: text; }
   ```
3. **Do not continuously send mouseMoved events** unless hover interaction is needed. This avoids the CDP internal cursor position being updated, which avoids confusing its state with agent-driven actions

**Phase to address:** Input injection polish phase.

---

## Phase-Specific Warning Summary

| Phase | Topic | Pitfall | Severity | Mitigation |
|-------|-------|---------|----------|------------|
| Input Click | Coordinate mapping | Off-by-growing-error from letterbox (#1) | CRITICAL | Compute letterbox offset, use naturalWidth/Height |
| Input Click | CDP dispatch | Silent failure from default params (#2) | CRITICAL | Always set button:'left', clickCount:1 |
| Input Click | Concurrency | User/agent race condition (#3) | CRITICAL | Input lock state machine or queue |
| Input Click | Stale frames | Clicking ghost elements (#4) | CRITICAL | Freshness indicator, click confirmation |
| Input Keyboard | CDP dispatch | Missing char event type (#5) | MODERATE | 3-event sequence: keyDown, char, keyUp |
| Input Mouse | Performance | mousemove event flood (#6) | MODERATE | Throttle to 10-20 events/sec |
| Input Scroll | Normalization | deltaMode differences (#7) | MODERATE | Normalize all modes to pixels, clamp |
| Input Feedback | Visual | No click/cursor/focus indicators (#8) | MODERATE | Click indicator overlay, cursor CSS |
| Input Keyboard | Focus | No focus before type (#9) | MODERATE | Click-to-focus, keyboard capture toggle |
| Input Click | Context menu | Host menu intercepts right-click (#10) | MINOR | preventDefault on contextmenu |
| Input Keyboard | Propagation | Host page captures keys (#11) | MINOR | stopPropagation in capture phase |
| Input Click | Navigation | mousePressed hangs on links (#12) | MINOR | Fire-and-forget mouseReleased |
| Input Cursor | Visual | Double cursor confusion (#13) | MINOR | Custom CSS cursor, avoid continuous mouseMoved |

---

## Architecture Implications for Input Injection

Based on these pitfalls, the implementation should:

1. **Separate coordinate mapping from event dispatch.** The coordinate transformation (Pitfall 1) should be a pure function that can be unit tested independently. Do not inline the mapping in the event handler.

2. **Build a proper CDP event sequence builder.** Clicks require 3 events (move, press, release) with specific parameters (Pitfall 2). Keyboard input requires 3 events (keyDown, char, keyUp) with specific field requirements (Pitfall 5). Encapsulate these sequences rather than exposing raw CDP to the WebSocket handler.

3. **Implement input coordination from day one.** The race condition between user and agent (Pitfall 3) is the most architecturally significant pitfall. Even a simple lock (reject user input during agent tool calls) prevents the worst outcomes. A proper solution needs a state machine.

4. **Add an overlay layer above the frame image.** Multiple pitfalls (8, 10, 13) are solved by having a transparent overlay div/canvas positioned over the `<img>` element. This overlay handles: click indicators, cursor styling, focus indicators, and event capture (preventing default browser behaviors).

5. **Throttle and normalize all continuous events.** mousemove (Pitfall 6) and scroll (Pitfall 7) are high-frequency events that must be throttled before crossing the WebSocket boundary. Build throttling into the client-side event handlers.

6. **Treat keyboard forwarding as a modal state.** Keyboard events should only forward when explicitly activated (Pitfall 9, 11). This prevents accidental host-page interactions and gives users clear control.

---

## Sources Index

**CDP Official Documentation:**
- [Chrome DevTools Protocol - Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/) -- dispatchMouseEvent, dispatchKeyEvent, dispatchTouchEvent specifications

**Chromium Bug Tracker:**
- [Chromium issue #40248189](https://issues.chromium.org/issues/40248189) -- dispatchMouseEvent not taking emulation scale into account
- [CDP screenX/screenY bug patcher](https://github.com/ObjectAscended/CDP-bug-MouseEvent-.screenX-.screenY-patcher) -- CDP sets fake screenX/screenY values

**CDP Community Issues:**
- [devtools-protocol issue #130](https://github.com/ChromeDevTools/devtools-protocol/issues/130) -- dispatchMouseEvent interfering with cursor position
- [devtools-protocol issue #74](https://github.com/ChromeDevTools/devtools-protocol/issues/74) -- modifiers not working with dispatchKeyEvent
- [devtools-protocol issue #45](https://github.com/ChromeDevTools/devtools-protocol/issues/45) -- sending Enter key event
- [chromote issue #30](https://github.com/rstudio/chromote/issues/30) -- dispatchMouseEvent hanging
- [webdriverio issue #7988](https://github.com/webdriverio/webdriverio/issues/7988) -- Target closed error
- [bugzilla #1740798](https://bugzilla.mozilla.org/show_bug.cgi?id=1740798) -- dispatchMouseEvent returns too early

**noVNC (Coordinate Scaling Reference):**
- [noVNC scaling issue #12](https://github.com/novnc/noVNC/issues/12) -- CSS scaling breaks mouse coordinates
- [noVNC local scaling broken #1155](https://github.com/novnc/noVNC/issues/1155) -- single scale factor limitation
- [noVNC position drift #258](https://github.com/novnc/noVNC/issues/258) -- fixed positioning breaks mouse mapping
- [noVNC stale frame #221](https://github.com/novnc/noVNC/issues/221) -- low FPS without mouse movement

**Remote Desktop & Streaming:**
- [Latency testing remote browsing](https://thume.ca/2022/05/15/latency-testing-streaming/) -- display streaming latency analysis
- [Chrome Remote Desktop cursor alignment](https://support.google.com/chrome/thread/40848321/cursor-alignment-bug-in-chrome-remote-desktop?hl=en)

**Browser Automation:**
- [Automating clicks in Chromium](https://medium.com/@aslushnikov/automating-clicks-in-chromium-a50e7f01d3fb) -- correct CDP click event sequence
- [Browser-use concurrent issues](https://github.com/browser-use/browser-use/issues/2575) -- agent exiting during concurrent operations
- [CDP typing discussion](https://groups.google.com/g/chrome-debugging-protocol/c/sYsatMpk9_I) -- dispatching key events for input fields

---

*Research completed: 2026-01-28*
