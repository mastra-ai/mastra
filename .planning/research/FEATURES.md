# Feature Landscape: Browser Input Injection (Assist Mode)

**Domain:** Input injection for browser live view panel in Mastra Studio
**Researched:** 2026-01-28
**Confidence:** HIGH
**Milestone:** v1.2 - User can interact with browser live view to unblock agents

## Context

This research focuses on input injection features for the v1.2 milestone. The v1.1 live view (view-only) is fully shipped:
- Live screencast of browser viewport in Studio panel (ScreencastStream, ViewerRegistry)
- Connection status indicators (StatusBadge with 8 states)
- Tool call history in collapsible panel section
- Close button to dismiss panel, collapsible header with URL display
- WebSocket transport at `/browser/:agentId/stream` (bidirectional, but client-to-server messages are not yet handled)
- `injectMouseEvent()` and `injectKeyboardEvent()` exist on `BrowserToolset` class

The v1.2 goal: users can click, type, and scroll in the live view panel to unblock agents stuck on CAPTCHAs, popups, or login prompts.

### Infrastructure Audit (What Already Exists)

| Component | Status | Gap for v1.2 |
|-----------|--------|---------------|
| `BrowserToolset.injectMouseEvent()` | EXISTS | Not in `BrowserToolsetLike` interface (core/agent/types.ts) |
| `BrowserToolset.injectKeyboardEvent()` | EXISTS | Not in `BrowserToolsetLike` interface |
| WebSocket bidirectional | EXISTS | `onMessage` handler is a no-op stub |
| `ScreencastFrameData.viewport` | EXISTS | Viewport metadata (width, height, offsets, pageScaleFactor) available per frame but NOT sent to client -- frames are sent as raw base64 strings |
| `BrowserViewFrame` img element | EXISTS | No mouse/keyboard event handlers |
| `useBrowserStream` hook | EXISTS | No `send()` method exposed |

### Critical Gap: Viewport Metadata Not Reaching Client

The `ViewerRegistry.broadcastFrame()` sends only `frame.data` (base64 string). The viewport metadata (`width`, `height`, `scrollOffsetX`, `scrollOffsetY`, `pageScaleFactor`) is available from `ScreencastFrameData` but discarded at the transport layer. Input injection requires this metadata for coordinate mapping.

---

## Table Stakes

Features users expect for input injection to feel usable. Without these, the feature is broken or produces wrong results.

### TS-1: Click Forwarding

| Aspect | Detail |
|--------|--------|
| **What** | User clicks on the live view img element; click is forwarded to the corresponding position in the actual browser viewport |
| **Why expected** | This is the core interaction. Agent hits CAPTCHA, user clicks to solve it. If clicks land in the wrong spot, the feature is useless |
| **Complexity** | Medium |
| **Dependencies** | Coordinate mapping (TS-4), WebSocket send (TS-6), `injectMouseEvent()` on server |

**Behavior:** User mousedown on img element -> capture (offsetX, offsetY) -> scale to browser viewport coordinates -> send via WebSocket -> server calls `browserToolset.injectMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 })` followed by `mouseReleased`.

**Industry pattern:** Browserbase Live View uses the same click-through-iframe approach. noVNC uses canvas click forwarding. AWS AgentCore uses DCV Web Client for native input capture. All translate client coordinates to server viewport coordinates.

### TS-2: Keyboard Input Forwarding

| Aspect | Detail |
|--------|--------|
| **What** | User types on the keyboard while the live view panel is focused; keystrokes are forwarded to the browser |
| **Why expected** | CAPTCHAs may require typing. Login prompts require username/password entry. Form fields need text input |
| **Complexity** | Medium |
| **Dependencies** | Focus management (TS-3), WebSocket send (TS-6), `injectKeyboardEvent()` on server |

**Behavior:** User presses key while live view is focused -> capture key event (key, code, modifiers) -> send via WebSocket -> server calls `browserToolset.injectKeyboardEvent({ type: 'keyDown', key, code })` followed by `char` (for text) and `keyUp`.

**CDP key event sequence for typing a character:**
1. `keyDown` (sets key state)
2. `char` (generates text input -- this is the event that actually types)
3. `keyUp` (releases key)

Special keys (Enter, Tab, Escape, Backspace, arrows) only need `keyDown` + `keyUp` without `char`.

**Industry pattern:** Playwright Inspector allows direct keyboard input in the headed browser window. OpenAI Operator captures keyboard in "takeover mode." noVNC forwards all keyboard events with modifier state.

### TS-3: Focus Management

| Aspect | Detail |
|--------|--------|
| **What** | The live view panel must be explicitly focused/activated to capture keyboard input, and must NOT capture input when the user is typing in the chat input |
| **Why expected** | Without focus management, typing a chat message would inject keystrokes into the browser, or clicking the chat area would click in the browser. This is the most common keyboard trap problem in web-based remote desktops |
| **Complexity** | Medium |
| **Dependencies** | None -- pure client-side |

**Behavior:** The live view frame area acts as a focus target. When the user clicks on the live view img, it enters "interactive mode" (keyboard events are captured). When the user clicks outside the live view (on chat, sidebar, etc.), keyboard capture stops. Visual indicator shows which mode is active.

**Industry patterns:**
- Browserbase: "Unlock Screen" button below the VNC window to take control
- noVNC: Focus trap on the VNC canvas element; local cursor hidden on mouse enter
- OpenAI Operator: Explicit "Take over browser" button
- AWS AgentCore: DCV Web Client handles focus natively

**Recommendation:** Use the Browserbase/Operator pattern -- do NOT auto-capture on hover. Require explicit click on the frame to enter interactive mode. This prevents accidental input injection.

**WCAG 2.1.2 compliance:** Users must be able to exit the focus trap. Pressing Escape or clicking outside the panel should release keyboard capture.

### TS-4: Coordinate Mapping (Scaled Frame to Browser Viewport)

| Aspect | Detail |
|--------|--------|
| **What** | Translate pixel coordinates from the displayed img element (which is scaled to fit the panel) to CSS pixel coordinates in the browser viewport |
| **Why expected** | The img element might display at 640x360 CSS pixels while the actual browser viewport is 1280x720. Without correct scaling, clicks land in wrong positions |
| **Complexity** | Medium |
| **Dependencies** | Viewport metadata from screencast frames reaching the client |

**The math:**

CDP `Input.dispatchMouseEvent` expects coordinates in **CSS pixels relative to the main frame's viewport origin (top-left)**.

The screencast frame provides:
- `viewport.width` / `viewport.height` (browser viewport in CSS pixels)
- `viewport.pageScaleFactor` (page zoom level)
- `viewport.scrollOffsetX` / `viewport.scrollOffsetY` (scroll position)
- `viewport.offsetTop` (browser chrome offset)

The displayed img element has a different size from the viewport. The mapping:

```
// Get click position relative to the img element
const rect = img.getBoundingClientRect();
const clientX = mouseEvent.clientX - rect.left;
const clientY = mouseEvent.clientY - rect.top;

// Scale to browser viewport coordinates
// img uses object-contain, so we need to account for letterboxing
const scaleX = viewport.width / displayedWidth;
const scaleY = viewport.height / displayedHeight;
const browserX = clientX * scaleX;
const browserY = clientY * scaleY;
```

The `object-contain` CSS on the img means the image may be letterboxed (black bars on sides/top). The mapping must account for the actual rendered image dimensions within the element, not just the element's bounding box.

**Industry pattern:** This is the exact problem noVNC has with scaled viewports (documented as a common source of bugs in their issue tracker). The fix is to track the ratio between display size and actual viewport size, and transform on every click. Canvas-based approaches use `scrollWidth/scrollHeight` vs `canvas.width/canvas.height` for the scale factor.

**Critical detail:** `pageScaleFactor` from CDP metadata matters when the page is zoomed. If pageScaleFactor is not 1.0, the mapping must divide by it.

### TS-5: Scroll Forwarding

| Aspect | Detail |
|--------|--------|
| **What** | User scrolls (mouse wheel) in the live view; scroll is forwarded to the browser viewport |
| **Why expected** | CAPTCHAs sometimes require scrolling. Long pages need scrolling to find content. Login forms may be below the fold |
| **Complexity** | Low |
| **Dependencies** | Coordinate mapping (TS-4), WebSocket send (TS-6) |

**Behavior:** User scrolls wheel while hovering over live view -> capture (deltaX, deltaY) -> send via WebSocket -> server calls `injectMouseEvent({ type: 'mouseWheel', x, y, deltaX, deltaY })`.

CDP `mouseWheel` event parameters: `deltaX` and `deltaY` are in CSS pixels. Positive deltaY scrolls down.

**Industry pattern:** Standard in all remote desktop tools. Scroll is the simplest input to forward because the coordinate mapping is less sensitive (scroll applies to the viewport, not to a specific point).

### TS-6: WebSocket Message Protocol (Client-to-Server)

| Aspect | Detail |
|--------|--------|
| **What** | Structured message format for sending input events from client to server over the existing WebSocket connection |
| **Why expected** | Infrastructure requirement -- without a defined protocol, input events cannot reach the server |
| **Complexity** | Low |
| **Dependencies** | None -- extending existing WebSocket |

**Message format (recommended):**

```typescript
// Client -> Server messages
type InputMessage =
  | { type: 'mouse'; event: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
      x: number; y: number; button?: string; clickCount?: number;
      deltaX?: number; deltaY?: number; modifiers?: number }
  | { type: 'keyboard'; event: 'keyDown' | 'keyUp' | 'char';
      key?: string; code?: string; text?: string; modifiers?: number }
```

The existing WebSocket already distinguishes message types by checking if data starts with `{`. Client-to-server messages should be JSON with a `type` discriminator.

**Industry pattern:** Every remote desktop tool (noVNC, RDP web client, Browserbase) uses structured JSON or binary messages with type discriminators for input events. This is standard.

### TS-7: Visual Feedback -- Interactive Mode Indicator

| Aspect | Detail |
|--------|--------|
| **What** | Clear visual indicator showing whether the live view is in interactive mode (accepting user input) or passive mode (view-only) |
| **Why expected** | Users need to know if their clicks/keystrokes are being captured. Without this, users will click, see nothing happen, and assume the feature is broken |
| **Complexity** | Low |
| **Dependencies** | Focus management (TS-3) |

**Behavior:** When the user clicks on the live view frame, a visual indicator appears (border highlight, mode label change, cursor change). When focus leaves, the indicator disappears.

**Recommended indicators:**
- **Border color change:** Neutral border in passive mode, accent/blue border in interactive mode (2px solid transition)
- **Cursor change:** Default cursor in passive mode, crosshair or pointer in interactive mode
- **Mode label:** StatusBadge changes from "Live" to "Interactive" (or add a second badge)

**Industry patterns:**
- Browserbase: "Unlock Screen" button that changes to active state
- noVNC: Hides local cursor when mouse enters canvas area (indicating capture)
- OpenAI Operator: "Take over" button transforms to "Hand back" button
- Chrome Remote Desktop: Blue outline on the remote viewport when active

---

## Differentiators

Features that would make input injection feel polished and professional. Not required for v1.2, but would elevate the UX.

### D-1: Click Ripple/Highlight Effect

| Aspect | Detail |
|--------|--------|
| **Value** | When user clicks on the live view, show a brief ripple or dot animation at the click point. Provides immediate visual confirmation that the click was registered before the browser responds |
| **Complexity** | Low |
| **Phase** | v1.2 (if time permits) or v1.3 |

**Why valuable:** Latency between click and visible browser response can be 100-500ms. Without immediate feedback, users will double-click or think the click was missed. A ripple at the click point provides sub-16ms feedback.

**Implementation:** CSS animation overlaid on the img element. Create a small circle at (offsetX, offsetY), animate opacity/scale over 300ms, remove.

**Industry pattern:** Material Design ripple effect on buttons. AutoHotkey cursor location scripts use expanding circles. Windows mouse cursor highlight uses ripple on Ctrl press.

### D-2: Cursor Position Tracking

| Aspect | Detail |
|--------|--------|
| **Value** | Show a faint cursor overlay on the live view matching where the user's mouse maps to in the browser viewport. Helps users aim precisely |
| **Complexity** | Medium |
| **Phase** | v1.3 |

**Why valuable:** The scaled image makes precise clicking difficult. A cursor overlay showing the mapped position helps users see exactly where their click will land, especially important for small CAPTCHA checkboxes or close buttons.

**Implementation:** Track mousemove events, transform coordinates, render an overlay dot/crosshair at the mapped position. Must be high-performance (useRef, no React state per move).

**Industry pattern:** noVNC renders both local cursor and remote cursor. Dual-cursor display is the standard in remote desktop tools. Some tools hide the local cursor entirely and only show the mapped cursor.

### D-3: Agent Pause/Resume Controls

| Aspect | Detail |
|--------|--------|
| **Value** | Explicit "Pause Agent" / "Resume Agent" buttons so the user can stop the agent from continuing while they interact with the browser |
| **Complexity** | High |
| **Phase** | v1.3 |

**Why valuable:** Without pause/resume, the agent and user may interact simultaneously, causing race conditions. The agent might click an element while the user is trying to solve a CAPTCHA. Playwright uses `page.pause()` for exactly this scenario.

**Industry patterns:**
- Playwright Inspector: "Resume" button to continue after `page.pause()`
- OpenAI Operator: Users can "pause, stop, or take over" at any time
- AWS AgentCore: Agent pauses automation and notifies operators via WebSocket. Operators resolve the issue and trigger resumption
- Browserbase/Convergence: Agent hits MFA, user gets Live View URL, finishes flow in same session

**Implementation challenge:** This requires agent-level hooks. The agent's generate loop must be pausable, which is a deeper integration than just input forwarding. For v1.2, rely on the natural "agent is waiting for tool response" pause rather than explicit pause control.

### D-4: Modifier Key Support

| Aspect | Detail |
|--------|--------|
| **Value** | Support Ctrl+click, Shift+click, Alt+key, and other modifier combinations |
| **Complexity** | Low |
| **Phase** | v1.2 (include in initial keyboard implementation) |

**Why valuable:** Some interactions require modifiers (Ctrl+A to select all, Shift+click for range selection, Tab to move between form fields). CDP supports modifiers via a bit field: Alt=1, Ctrl=2, Meta/Command=4, Shift=8.

**Implementation:** Read modifier state from the DOM event (`event.altKey`, `event.ctrlKey`, `event.metaKey`, `event.shiftKey`), encode as bit field, include in WebSocket message.

### D-5: Right-Click Context Menu Prevention

| Aspect | Detail |
|--------|--------|
| **Value** | Prevent the browser's native right-click context menu on the live view, and instead forward right-clicks to the remote browser |
| **Complexity** | Low |
| **Phase** | v1.2 (include in click handler) |

**Implementation:** `event.preventDefault()` on `contextmenu` event. Forward as `button: 'right'` in the mouse event.

### D-6: Touch Event Support

| Aspect | Detail |
|--------|--------|
| **Value** | Support tap, drag, pinch-to-zoom on mobile/tablet devices viewing Studio |
| **Complexity** | Medium |
| **Phase** | v1.3+ |

**Why valuable:** Studio may be accessed from tablet/mobile. Touch events need separate handling from mouse events. CDP supports `Input.dispatchTouchEvent` with touchpoints array.

**Implementation challenge:** Touch coordinate mapping, multi-touch gesture detection, preventing viewport zoom on the Studio page itself.

### D-7: Keyboard Shortcut Pass-Through

| Aspect | Detail |
|--------|--------|
| **Value** | System-level shortcuts like Ctrl+C, Ctrl+V, Ctrl+A are forwarded to the remote browser instead of being handled by the Studio page |
| **Complexity** | Medium |
| **Phase** | v1.3 |

**Why valuable:** Users may need to paste a CAPTCHA answer or copy text. Without shortcut pass-through, Ctrl+V would paste into the Studio UI rather than the browser.

**Industry pattern:** Chrome Remote Desktop, noVNC, and web-based RDP clients all handle this. The Keyboard Lock API (`navigator.keyboard.lock()`) can capture system keys but requires fullscreen mode. For non-fullscreen, `event.preventDefault()` + `event.stopPropagation()` on specific key combos is the standard approach.

**Partial solution for v1.2:** Forward Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Backspace, Delete, Enter, Tab, Escape, arrow keys. Use `preventDefault()` to stop the Studio page from handling them.

---

## Anti-Features

Features to deliberately NOT build for v1.2. These add complexity without proportional value or create user experience problems.

### AF-1: Full Takeover Mode (Agent Stops Entirely)

| Aspect | Detail |
|--------|--------|
| **What** | User fully takes over the browser, agent is suspended, user becomes sole controller |
| **Why avoid** | Requires deep agent suspension hooks (pausing the generate loop, preserving agent state, resuming from exact position). The assist model (agent and user can both act) is simpler and covers the primary use case (CAPTCHA solving). Full takeover is explicitly scoped to v1.3 in PROJECT.md |
| **What instead** | Assist mode: user can click/type in the live view at any time. Agent continues its process. Natural interleaving handles most cases since agents wait for tool responses |

### AF-2: Simultaneous Input Conflict Resolution

| Aspect | Detail |
|--------|--------|
| **What** | Detecting when user and agent both try to interact with the browser at the same time and resolving the conflict (e.g., queuing, locking, priority) |
| **Why avoid** | Adds significant complexity. In practice, the user intervenes when the agent is stuck (waiting, in an error loop). The race condition window is small. Adding locks would delay both user and agent actions and create new failure modes |
| **What instead** | Accept the rare race condition. The agent will take a new snapshot after its next action and adapt to whatever state the page is in. Users will see the live view update and know their action took effect |

### AF-3: Element Hover Highlights

| Aspect | Detail |
|--------|--------|
| **What** | As the user hovers over the live view, highlight the element under the cursor (like browser DevTools inspect mode) |
| **Why avoid** | Requires running JavaScript injection on the remote page to identify elements at coordinates, or using CDP's DOM.getNodeForLocation. Both add latency per mousemove event (hundreds per second). The live view is a JPEG image -- there is no DOM information available client-side to overlay highlights. This would require a round-trip to the server per mouse move |
| **What instead** | Users see the live browser respond naturally. Hover effects on the actual page (button highlights, link underlines) will appear in the next screencast frame, typically within 100-300ms |

### AF-4: Drag and Drop Support

| Aspect | Detail |
|--------|--------|
| **What** | User can click-and-drag in the live view to perform drag-and-drop operations in the browser |
| **Why avoid** | Drag-and-drop requires tracking mouseDown -> mouseMove (many events) -> mouseUp with precise coordinate mapping for every intermediate point. The latency of the screencast feedback loop (100-500ms) makes drag operations feel broken. This is a known pain point in VNC/remote desktop tools |
| **What instead** | Click and type are sufficient for CAPTCHA solving, form filling, and popup dismissal -- the primary use cases. Drag operations are rare in these scenarios |

### AF-5: File Upload via Drag-and-Drop

| Aspect | Detail |
|--------|--------|
| **What** | User drags a file from their desktop onto the live view to upload it to the remote browser |
| **Why avoid** | Requires transferring the file to the server, then injecting it into the browser's file input. This is a complex file transfer protocol, not simple input injection. CDP has no native file upload via input injection |
| **What instead** | For v1.2, if the agent needs to upload a file, it can use the existing type tool to set file paths (if supported by the automation framework) or the user can guide the agent with chat messages |

### AF-6: Copy/Paste Clipboard Sync

| Aspect | Detail |
|--------|--------|
| **What** | Synchronize clipboard between the user's machine and the remote browser so Ctrl+C in the browser copies to the user's clipboard and vice versa |
| **Why avoid** | Clipboard API requires secure context (HTTPS) and user permission. Cross-origin clipboard access is restricted. Syncing clipboard between two different execution contexts (Studio page and remote browser process) requires a custom protocol. Browserbase's iframe embedding needs explicit sandbox permissions (`clipboard-read; clipboard-write`) for this |
| **What instead** | For v1.2, forward Ctrl+C/Ctrl+V keystrokes to the browser. The browser's clipboard is isolated (not synced with user's), but text typed via keyboard input works. Full clipboard sync is a v2 feature |

### AF-7: Mouse Cursor Style Sync

| Aspect | Detail |
|--------|--------|
| **What** | Change the cursor style in the live view panel to match the cursor style in the remote browser (e.g., pointer when hovering a link, text cursor when hovering an input) |
| **Why avoid** | Requires querying the remote browser's computed cursor style at the mapped coordinates on every mouse move (CDP round-trip). The latency makes this feel laggy. noVNC has extensive issues with cursor rendering (issues #131, #620, #1014, #1430). The dual-cursor problem (local vs remote) is a known UX trap in remote desktop tools |
| **What instead** | Use a fixed crosshair cursor when in interactive mode. This is clear, consistent, and does not require server round-trips |

---

## Feature Dependencies

```
Existing infrastructure (v1.1 shipped)
    |
    +---> BrowserToolset.injectMouseEvent()     [EXISTS, needs interface addition]
    +---> BrowserToolset.injectKeyboardEvent()  [EXISTS, needs interface addition]
    +---> WebSocket (bidirectional)             [EXISTS, needs onMessage handler]
    +---> BrowserViewFrame (img element)        [EXISTS, needs event handlers]
    +---> useBrowserStream hook                 [EXISTS, needs send() capability]
    +---> ScreencastFrameData.viewport          [EXISTS, needs client delivery]
    |
    v
Input Injection (v1.2)
    |
    +---> [TS-6] WebSocket message protocol     (Foundation -- all other features need this)
    |         |
    |         v
    +---> [TS-4] Coordinate mapping             (Requires viewport metadata at client)
    |         |
    |         +---> [TS-1] Click forwarding     (Requires coordinate mapping + WS protocol)
    |         +---> [TS-5] Scroll forwarding    (Requires coordinate mapping + WS protocol)
    |         +---> [D-2]  Cursor position      (Requires coordinate mapping)
    |
    +---> [TS-3] Focus management               (Independent -- pure client-side)
    |         |
    |         +---> [TS-2] Keyboard forwarding  (Requires focus management + WS protocol)
    |         +---> [TS-7] Interactive mode indicator (Requires focus management)
    |
    +---> [D-1]  Click ripple effect            (Independent -- pure CSS/client)
    +---> [D-4]  Modifier key support           (Included in keyboard/mouse handlers)
    +---> [D-5]  Right-click prevention         (Included in click handler)
```

**Build order implication:** Start with WebSocket protocol and viewport metadata delivery (server-side), then coordinate mapping (client), then click/scroll (uses both), then focus management + keyboard (client), then visual polish.

---

## Assist Mode UX Pattern

Based on research across Browserbase, AWS AgentCore, OpenAI Operator, and Playwright Inspector, the "assist mode" pattern for browser agents has converged on a consistent interaction model.

### The Canonical Pattern

1. **Agent works autonomously.** User watches in live view (passive mode)
2. **Agent gets stuck.** CAPTCHA appears, popup blocks progress, login required
3. **User takes action.** User clicks on the live view frame to enter interactive mode
4. **Visual confirmation.** Panel border changes, cursor changes, "Interactive" badge appears
5. **User interacts.** Clicks to solve CAPTCHA, types password, dismisses popup
6. **User releases control.** Clicks outside the panel, or presses Escape
7. **Agent continues.** Agent takes next snapshot, sees the page has changed, continues working

### How This Maps to v1.2

| Pattern Step | v1.2 Implementation |
|-------------|---------------------|
| Agent works autonomously | Existing -- agent calls tools, live view shows progress |
| Agent gets stuck | Existing -- user sees it in live view |
| User takes action | NEW: Click on live view frame enters interactive mode |
| Visual confirmation | NEW: Border highlight + "Interactive" mode badge |
| User interacts | NEW: Click, type, scroll forwarded to browser |
| User releases control | NEW: Click outside panel or press Escape |
| Agent continues | Existing -- agent's next tool call adapts to page state. Or user types "continue" in chat |

### What We Are NOT Building (Explicit Non-Goals)

- **Automatic agent pause on user interaction:** Would require deep integration with the agent generate loop
- **Automatic agent resume after user interaction:** Same issue -- agent resume requires knowing that user is done
- **"Hand back to agent" button:** Implies takeover mode; we are building assist mode
- **User notification when agent needs help:** Agent does not have a "stuck" signal for v1.2. User watches the live view and intervenes when they see a problem

---

## Technical Requirements

### Input Event Latency

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Click injection latency | < 100ms (client -> server -> CDP) | Clicks must feel responsive. Feedback comes via screencast frame at ~200ms |
| Keyboard injection latency | < 50ms | Typing needs to feel realtime; visual feedback via next frame |
| Scroll injection latency | < 100ms | Scroll should feel smooth-ish; frame update at ~200ms |
| Visual feedback (ripple) | < 16ms | Must appear immediately on user action, before server round-trip |

### Coordinate Mapping Accuracy

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Click accuracy | Within 2 CSS pixels of intended target | CAPTCHA checkboxes are typically 20x20px minimum |
| Aspect ratio preservation | Exact match to source viewport | Distortion would make coordinate mapping impossible |
| object-contain letterboxing | Correctly excluded from mapping | Clicks on black bars must be ignored or correctly mapped |

### Keyboard Capture Scope

| Key Category | Forwarded | Notes |
|-------------|-----------|-------|
| Printable characters (a-z, 0-9, symbols) | Yes | Via `keyDown` + `char` + `keyUp` sequence |
| Enter, Tab, Escape | Yes | Via `keyDown` + `keyUp` (no `char`) |
| Backspace, Delete | Yes | Must `preventDefault()` to avoid browser back navigation |
| Arrow keys | Yes | Navigation within forms |
| Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X | Yes | Must `preventDefault()` + `stopPropagation()` |
| F1-F12 | No | Let browser handle these (DevTools, etc.) |
| Alt+Tab, Cmd+Tab | No | Cannot capture OS-level shortcuts without Keyboard Lock API + fullscreen |
| Ctrl+W, Ctrl+T | No | Let browser handle tab management |

### WebSocket Protocol

| Requirement | Detail |
|-------------|--------|
| Message format | JSON with `type` discriminator |
| Direction | Client -> Server (input events) |
| Validation | Server validates message format before injection |
| Error handling | Server sends error response if injection fails |
| Viewport metadata | Server -> Client (with each frame or on change) |

---

## MVP Recommendation for v1.2

### Must Have (Ship Blockers)

1. **Click forwarding** (TS-1) -- core interaction
2. **Keyboard input forwarding** (TS-2) -- form filling, CAPTCHA text entry
3. **Focus management** (TS-3) -- prevent accidental input
4. **Coordinate mapping** (TS-4) -- correct click positioning
5. **Scroll forwarding** (TS-5) -- page navigation
6. **WebSocket message protocol** (TS-6) -- transport layer
7. **Interactive mode indicator** (TS-7) -- user knows input is captured

### Should Have (Include If Straightforward)

8. **Modifier key support** (D-4) -- low complexity, included in keyboard handler
9. **Right-click prevention** (D-5) -- low complexity, included in click handler
10. **Click ripple effect** (D-1) -- low complexity, immediate visual feedback

### Nice to Have (v1.3)

11. **Cursor position tracking** (D-2) -- medium complexity, coordinate overlay
12. **Agent pause/resume** (D-3) -- high complexity, agent integration
13. **Touch event support** (D-6) -- medium complexity, mobile use case
14. **Keyboard shortcut pass-through** (D-7) -- medium complexity, system key capture

---

## Competitive Landscape (Updated for Input Injection)

| Feature | Browserbase | AWS AgentCore | OpenAI Operator | Playwright | Our v1.2 |
|---------|-------------|---------------|-----------------|------------|----------|
| Click in live view | Yes (via iframe/VNC) | Yes (DCV client) | Yes (takeover mode) | No (separate window) | Yes |
| Type in live view | Yes | Yes | Yes (takeover mode) | Yes (headed browser) | Yes |
| Scroll in live view | Yes | Yes | Yes | N/A | Yes |
| Focus management | Iframe sandbox | DCV native | Explicit "take over" | N/A (separate window) | Click-to-activate |
| Coordinate mapping | Handled by VNC | Handled by DCV | Handled by browser | N/A | Custom (CDP viewport metadata) |
| Click feedback | No | No | No | N/A | Yes (ripple effect) |
| Agent pause/resume | Session-level | WebSocket notification | Explicit button | page.pause() | No (v1.3) |
| Clipboard sync | Yes (iframe sandbox) | Yes (DCV) | Yes | N/A | No (v1.3) |

**Our positioning:** Assist mode (not takeover). User can intervene without stopping the agent. Click feedback (ripple) is a differentiator -- no competitor shows immediate visual confirmation of click registration.

---

## Sources

### Primary (HIGH confidence)
- [Chrome DevTools Protocol - Input domain](https://chromedevtools.github.io/devtools-protocol/tot/Input/) -- CDP dispatchMouseEvent, dispatchKeyEvent API reference
- Existing codebase: `integrations/agent-browser/src/toolset.ts` -- injectMouseEvent/injectKeyboardEvent signatures
- Existing codebase: `packages/deployer/src/server/browser-stream/` -- WebSocket transport, ViewerRegistry
- Existing codebase: `packages/playground-ui/src/domains/agents/` -- BrowserViewFrame, useBrowserStream

### Secondary (MEDIUM confidence)
- [Browserbase Live View](https://docs.browserbase.com/features/session-live-view) -- Interactive embedding, VNC-based click/type/scroll
- [AWS AgentCore Browser](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-tool.html) -- DCV-powered live view with human takeover
- [OpenAI Operator](https://openai.com/index/introducing-operator/) -- Takeover mode, explicit user control handoff
- [noVNC](https://github.com/novnc/noVNC) -- Canvas coordinate mapping, cursor rendering issues (#12, #131, #620, #1014)
- [Canvas coordinate mapping](https://riptutorial.com/html5-canvas/example/19534/mouse-coordinates-after-resizing--or-scrolling-) -- getBoundingClientRect() + CSS scaling formula
- [Keyboard Lock API](https://web.dev/keyboard-lock/) -- System key capture in fullscreen mode
- [WCAG 2.1.2 No Keyboard Trap](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html) -- Accessibility requirements for focus trapping

### Community (LOW confidence -- patterns observed, not verified)
- [Click ripple effect](https://dev.to/leonardoschmittk/how-to-make-a-mouse-ripple-click-effect-with-css-js-and-html-in-2-steps-2fcf) -- CSS/JS implementation pattern
- [Playwright page.pause()](https://playwright.dev/docs/api/class-page#page-pause) -- Human-in-the-loop debugging pattern
- [Remote desktop keyboard capture](https://learn.microsoft.com/en-us/answers/questions/1289668/web-client-escape-key-intercepted-by-web-browser-i) -- Key interception challenges

---

*Research completed: 2026-01-28*
*Focus: Input injection features for v1.2 browser assist mode*
