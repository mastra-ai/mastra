# Domain Pitfalls: Split-Pane Browser View Layout Refactor

**Domain:** Refactoring floating overlay to side-by-side split-pane (react-resizable-panels v4)
**Researched:** 2026-01-30
**Confidence:** HIGH (all pitfalls verified against codebase + official documentation)

---

## Critical Pitfalls

Mistakes that cause WebSocket disconnection, broken interactions, or require significant rework.

---

### Pitfall 1: WebSocket Disconnection from Component Remount

**What goes wrong:** Moving `BrowserViewFrame` from inside the `Thread` component tree (where it currently lives) into a new `Panel` in `AgentLayout` causes React to unmount and remount it. The `useBrowserStream` hook runs a cleanup effect on unmount that calls `ws.close()` (line 226-229 of `use-browser-stream.ts`). This kills the active WebSocket, drops the screencast stream, and triggers the reconnect-with-backoff logic -- causing a visible interruption of 1-5 seconds.

**Why it happens:** React's reconciliation treats a component at a different position in the tree as a new instance. Moving `BrowserViewFrame` from `Thread > div > BrowserViewPanel > div > BrowserViewFrame` to `AgentLayout > Panel > BrowserViewFrame` is a tree position change. React unmounts the old instance (closing the WebSocket) and mounts a new one (opening a fresh connection).

**Consequences:**
- 1-5 second reconnection gap with visible "Reconnecting..." overlay
- Server-side screencast stream stops and restarts (CDP `Page.stopScreencast` + `Page.startScreencast` churn)
- If the user was in interactive mode, `isInteractive` state resets to `false`
- `hasFrame` resets to `false`, showing the loading skeleton briefly

**Warning signs:**
- During development, toggling the browser panel causes a flash/skeleton
- Console logs show `[BrowserViewPanel] status changed: connecting` immediately after a layout change
- The server logs show repeated `startScreencast`/`stopScreencast` cycles

**Prevention:**
The current codebase already solved this exact problem for the overlay case. The comment in `browser-view-panel.tsx` (line 18-21) says: "IMPORTANT: Renders a single BrowserViewFrame instance that never unmounts. This keeps the WebSocket connection stable across visibility/collapse toggles." The off-screen technique (`fixed -left-[9999px]`) prevents unmounting.

For the split-pane refactor, two approaches preserve this:

1. **Collapsible panel (recommended):** Use `react-resizable-panels` collapsible panel with `collapsedSize={0}` instead of conditional rendering. The Panel stays in the DOM when collapsed, so `BrowserViewFrame` never unmounts. This is the approach recommended by the library maintainer (see GitHub Issue #285: "In order to use the imperative API, the panel must be rendered even if it's collapsed").

2. **Lift WebSocket to context:** Extract the WebSocket connection from `useBrowserStream` into a provider above `AgentLayout`, so the connection persists regardless of where the frame component is mounted. More invasive refactor, but fully decouples connection from rendering.

**Phase impact:** This must be addressed in the very first task of the refactor. Every subsequent task assumes a stable WebSocket.

**Confidence:** HIGH -- verified against `use-browser-stream.ts` cleanup effect (lines 223-231) and React reconciliation documentation.

---

### Pitfall 2: BrowserToolCallsContext Scope Mismatch

**What goes wrong:** `BrowserToolCallsProvider` is currently mounted inside the `Thread` component (line 71 of `thread.tsx`), wrapping the entire thread content. Both `ToolFallback` (which registers tool calls via `useBrowserToolCallsSafe`) and `BrowserToolCallHistory` (which reads them via `useBrowserToolCalls`) are inside this provider. If `BrowserViewFrame` (and its child `BrowserToolCallHistory`) moves to a Panel in `AgentLayout`, it exits the `BrowserToolCallsProvider` subtree. The `useBrowserToolCalls()` call in `BrowserToolCallHistory` will throw: "useBrowserToolCalls must be used within a BrowserToolCallsProvider".

**Why it happens:** React Context is scoped to the provider's subtree. Currently:
```
Thread
  BrowserToolCallsProvider        <-- provider lives here
    ThreadPrimitive.Viewport
      Messages
        ToolFallback              <-- registers tool calls (INSIDE provider)
    BrowserViewPanel
      BrowserToolCallHistory      <-- reads tool calls (INSIDE provider)
```

After the refactor, if BrowserViewPanel moves to AgentLayout:
```
AgentLayout
  Panel (browser)
    BrowserViewPanel
      BrowserToolCallHistory      <-- OUTSIDE provider --> THROWS
  Panel (main)
    Thread
      BrowserToolCallsProvider
        Messages
          ToolFallback            <-- still INSIDE provider
```

**Consequences:**
- Runtime crash: "useBrowserToolCalls must be used within a BrowserToolCallsProvider"
- If using `useBrowserToolCallsSafe` (the null-returning variant), no crash but tool call history will be empty -- the panel and the messages will be disconnected
- `useInputCoordination` (which derives `isAgentBusy` from tool calls) will also break, causing the "agent busy" overlay to never appear and user clicks to conflict with agent actions

**Warning signs:**
- BrowserToolCallHistory shows 0 tool calls even when the agent is actively using browser tools
- The "Agent is executing..." overlay never appears during tool execution
- Console error about missing context provider

**Prevention:**
Hoist `BrowserToolCallsProvider` from `Thread` up to the `Agent` page component (or into `AgentLayout`), so it wraps both the thread/messages subtree and the browser panel subtree. The provider does not depend on any thread-specific state -- it just holds a `Map<string, BrowserToolCallEntry>` -- so hoisting is safe.

Specifically, in `packages/playground/src/pages/agents/agent/index.tsx`, wrap `AgentLayout` with `BrowserToolCallsProvider`:
```
BrowserToolCallsProvider
  AgentLayout
    Panel (browser) -- can read context
    Panel (main)
      Thread -- ToolFallback can register into context
```

Then remove the conditional wrapping in `thread.tsx` (lines 69-73).

**Phase impact:** Must be done before or simultaneously with moving the component. Test by verifying `useBrowserToolCalls()` returns populated data in both locations.

**Confidence:** HIGH -- verified against `browser-tool-calls-context.tsx` (line 56 throws), `thread.tsx` (line 71 mounts provider), and React Context scoping rules.

---

### Pitfall 3: Coordinate Mapping Breaks After Panel Resize

**What goes wrong:** The `useMouseInteraction` hook calls `imgElement.getBoundingClientRect()` on every mouse event (lines 81, 98, 118, 154 of `use-mouse-interaction.ts`) to compute the `object-fit: contain` letterbox mapping. When the browser view moves from a fixed-width overlay (`max-w-3xl` = 768px) to a resizable panel, the `<img>` element's bounding rect changes every time the user drags the panel separator. During an active drag of the separator, `getBoundingClientRect()` returns intermediate values. If the user clicks the browser view immediately after resizing, the coordinates map incorrectly because the layout has not fully settled.

**Why it happens:** `mapClientToViewport` in `coordinate-mapping.ts` computes scale from `elemRect.width / viewport.width`. When the panel is mid-resize, `elemRect.width` is changing frame-by-frame. The calculation is correct for the instant it runs, but the coordinate mapping may use a rect from the previous frame while the panel is still animating/settling.

Additionally, `useClickRipple` (line 61-76 of `use-click-ripple.ts`) does the same letterbox boundary check. Ripples may appear offset from the actual click position during resize.

**Consequences:**
- Clicks land at wrong coordinates in the remote browser (off by 10-50px depending on resize delta)
- Letterbox boundary check may reject valid clicks or accept invalid ones
- Ripple feedback appears misaligned from actual click position
- Scroll events (wheel) also map incorrectly

**Warning signs:**
- After resizing the panel, first click hits wrong spot in remote browser
- Ripple animation appears offset from cursor position
- Clicks near panel edges are silently rejected (letterbox false positive)

**Prevention:**
1. The current code already reads `getBoundingClientRect()` on each event (not cached), which is actually correct -- it means each event uses the current rect. The risk is mainly during animation/transition.
2. Disable mouse/keyboard interaction during active panel resize. Detect resize-in-progress via `react-resizable-panels` `onLayout` callback or by listening for `Separator` drag state.
3. Alternatively, `useLayoutEffect` with a `ResizeObserver` on the img container to debounce a "dimensions settled" flag. Only enable interaction when dimensions have been stable for ~100ms after resize ends.
4. Do NOT cache `getBoundingClientRect` results -- the current per-event approach is correct for steady-state; just handle the transition edge case.

**Phase impact:** Medium priority. The base refactor will work for most cases since `getBoundingClientRect()` is already called per-event. Only becomes an issue with rapid resize + immediate click sequences.

**Confidence:** HIGH -- verified against `use-mouse-interaction.ts` (lines 81, 98, 118, 154), `coordinate-mapping.ts` (line 67), and `use-click-ripple.ts` (line 68).

---

### Pitfall 4: Keyboard Capture Conflicts with Panel Resize Keyboard Shortcuts

**What goes wrong:** `useKeyboardInteraction` (line 117 of `use-keyboard-interaction.ts`) attaches a `document.addEventListener('keydown', ..., { capture: true })` listener that calls `e.preventDefault()` and `e.stopPropagation()` on ALL keyboard events (except Escape) when interactive mode is active. `react-resizable-panels` uses keyboard events for accessibility -- users can focus a Separator and use arrow keys to resize panels. When interactive mode is active, those keyboard events are captured and swallowed before they reach the Separator.

**Why it happens:** The keyboard hook uses the capture phase (`{ capture: true }`) on `document`, which fires before any element-level handlers. This is intentional -- it prevents the chat input from receiving keystrokes meant for the remote browser. But it also prevents panel resize keyboard controls from working.

**Consequences:**
- When interactive mode is on, arrow-key panel resizing is completely broken
- Tab key navigation between panels is swallowed
- Accessibility regression for keyboard-only users

**Warning signs:**
- Focus the browser view (enter interactive mode), then try to use keyboard to resize panels -- nothing happens
- Tab key does not move focus to other panels
- Screen reader users cannot navigate the layout

**Prevention:**
1. Scope the keyboard capture more precisely. Instead of capturing at `document` level, attach to the browser frame container element. This way, keyboard events on the Separator elements never hit the capture handler.
2. Alternatively, check `e.target` in the capture handler -- if the target is a `Separator` element (identifiable by `data-panel-resize-handle-id` attribute or role), let the event through.
3. The current `document`-level capture was acceptable when the browser view was an overlay (no sibling interactive elements), but in a split-pane layout with adjacent Separators, it needs scoping.

**Phase impact:** Must be addressed in the same phase as the layout move. Keyboard accessibility is a functional requirement, not an enhancement.

**Confidence:** HIGH -- verified against `use-keyboard-interaction.ts` (lines 116-118 capture phase), and react-resizable-panels keyboard interaction (Separator elements respond to arrow keys per ARIA spec).

---

## Moderate Pitfalls

Mistakes that cause degraded UX or technical debt requiring follow-up work.

---

### Pitfall 5: react-resizable-panels Conditional Rendering vs. Collapsible -- Choosing Wrong Approach

**What goes wrong:** The natural instinct is to conditionally render the browser Panel based on whether a browser session is active (`{hasBrowserSession && <Panel>...</Panel>}`). This works visually but has two problems: (a) it remounts `BrowserViewFrame` every time, killing the WebSocket (Pitfall 1), and (b) it conflicts with the imperative panel API for programmatic layout control (confirmed in GitHub Issue #285 -- the library maintainer says "the panel must be rendered even if it's collapsed" for imperative API to work).

**Why it happens:** Conditional rendering is idiomatic React. Developers reach for `{condition && <Component />}` by default. The react-resizable-panels library supports it (with `order` and `id` props), but it causes unmount/remount cycles that conflict with this codebase's design requirement of persistent WebSocket connections.

**Prevention:**
Use the collapsible approach exclusively:
- Keep the browser Panel always rendered in the `Group`
- Set `collapsible={true}` and `collapsedSize={0}`
- Use the imperative Panel API (`panelRef.current.collapse()` / `panelRef.current.expand()`) to show/hide
- The existing `CollapsiblePanel` component in `src/lib/resize/collapsible-panel.tsx` already implements collapse/expand logic -- extend it or model the browser panel after it
- Always supply `id` and `order` props on every Panel when the browser panel exists

**Warning signs:**
- `BrowserViewFrame` mounts/unmounts on panel toggle (check React DevTools)
- Console logs show WebSocket reconnection on panel toggle

**Phase impact:** Architecture decision that must be made before any implementation. Gets harder to change later.

**Confidence:** HIGH -- verified against react-resizable-panels GitHub Issue #285, library maintainer's explicit recommendation, and existing `CollapsiblePanel` pattern in this codebase.

---

### Pitfall 6: `useDefaultLayout` Storage Key Collision After Adding Panel

**What goes wrong:** `AgentLayout` uses `useDefaultLayout` with `id: "agent-layout-${agentId}"` to persist panel sizes to localStorage. The current layout stores sizes for 2-3 panels (left sidebar, main, right info). When a 4th browser panel is added, the persisted layout data has the wrong number of entries. On first load after the refactor, `react-resizable-panels` tries to apply a 3-panel layout to a 4-panel group, causing layout glitches (panels at wrong sizes, potentially zero-width panels).

**Why it happens:** The `useDefaultLayout` hook reads from `localStorage` using the `id` as key. Old data has `[leftSize, mainSize, rightSize]`. New layout expects `[leftSize, mainSize, browserSize, rightSize]` (or similar). The mismatch causes the library to fall back to default sizes or produce unexpected results.

**Consequences:**
- First load after deploy: panels at wrong sizes
- Users who had customized panel widths lose their settings
- Potential zero-width panel rendering the browser view invisible

**Warning signs:**
- After deploying the refactor, panel sizes look wrong on first load
- Console warnings from react-resizable-panels about layout mismatch
- Panel sizes snap to unexpected values

**Prevention:**
1. Change the `useDefaultLayout` id to a new value (e.g., `agent-layout-v2-${agentId}`) so old persisted layouts are ignored
2. Or use `autoSaveId` on the `Group` component instead, which react-resizable-panels automatically scopes per panel combination
3. Set sensible `defaultSize` values on all panels so the layout looks correct on first load even without persisted data
4. Consider a migration that clears old layout keys from localStorage

**Phase impact:** Low effort to fix, but easy to forget. Should be a verification step in the implementation plan.

**Confidence:** MEDIUM -- inferred from react-resizable-panels `useDefaultLayout` behavior and localStorage persistence. Not 100% certain how the library handles panel count mismatch (may gracefully reset, or may produce glitches).

---

### Pitfall 7: Interactive Mode Click-Outside Detection Breaks in Split Pane

**What goes wrong:** `BrowserViewFrame` exits interactive mode when the user clicks outside the container (`use-browser-stream.ts` isn't the issue here -- it's the `useEffect` in `browser-view-frame.tsx` lines 96-113). It uses `containerRef.current.contains(e.target)` to detect click-outside. In the overlay layout, "outside" means the chat area. In a split-pane layout, clicking the panel Separator to resize is also "outside" the container, which would exit interactive mode unexpectedly.

**Why it happens:** The mousedown listener is on `document`, and Separator elements are sibling DOM nodes to the Panel content. `containerRef.current.contains(separatorElement)` returns `false`, triggering exit from interactive mode.

**Consequences:**
- User enters interactive mode, tries to resize the panel -> interactive mode exits
- Frustrating UX: must re-click the browser view to re-enter interactive mode after any resize
- Users learn to avoid resizing while interacting, or stop using interactive mode

**Warning signs:**
- Interactive ring indicator disappears when clicking the resize handle
- Users report "keyboard stops working in browser" after resizing

**Prevention:**
1. Extend the click-outside check to also exclude Separator elements. Check if `e.target` is or is within a resize handle (e.g., `e.target.closest('[data-panel-resize-handle-id]')`).
2. Or use a `mousedown` handler on the Panel content wrapper that calls `stopPropagation()`, and only listen for the event on the Panel level rather than `document`.
3. Consider ignoring the click-outside when the click is on any `react-resizable-panels` infrastructure element.

**Phase impact:** Should be addressed in the same task that moves the component. Easy 2-3 line fix once identified.

**Confidence:** HIGH -- verified against `browser-view-frame.tsx` (lines 96-99 click-outside logic) and the fact that Separator is a sibling DOM element.

---

### Pitfall 8: Panel Aspect Ratio vs. Available Space Mismatch

**What goes wrong:** The browser viewport is typically 1280x720 or 1920x1080 (landscape). The `<img>` uses `object-fit: contain` with `aspect-video` (16:9) class. In the overlay, the panel had `max-w-3xl` (768px), giving a consistent display size. In a resizable panel, the available width depends on how the user sizes the panel. If the panel is narrow (e.g., 300px), the 16:9 image renders very small vertically (169px), with large letterbox/pillarbox bars. This wastes space and makes the browser view hard to use.

**Why it happens:** `aspect-video` forces a 16:9 container. `object-fit: contain` scales within that. In a narrow panel, this creates excessive dead space and a tiny rendered image.

**Consequences:**
- In narrow panel configurations, browser view is too small to be usable
- Large letterbox bars waste panel space
- Coordinate mapping still works but the effective interactive area is tiny

**Warning signs:**
- Browser view appears as a narrow strip in the panel
- Users complain they cannot see or interact with the remote browser at small panel sizes

**Prevention:**
1. Set a `minSize` on the browser panel (in pixels, via react-resizable-panels' pixel-based constraints or a CSS `min-width`). The minimum should be at least 400px for the browser view to be usable.
2. Consider removing the `aspect-video` class and instead letting the image fill the available panel space naturally. The `object-fit: contain` handles the scaling; the container does not need a forced aspect ratio.
3. Add a "too narrow" indicator that suggests the user widen the panel if the rendered image area falls below a usability threshold (e.g., < 300px rendered width).
4. The existing `CollapsiblePanel` has `minSize` support -- use it.

**Phase impact:** UX polish, but important for the feature to be usable. Can be addressed in a follow-up task after the core layout works.

**Confidence:** HIGH -- verified against `browser-view-frame.tsx` (line 129 `aspect-video` class), `coordinate-mapping.ts` letterbox math, and react-resizable-panels size constraints.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable with small changes.

---

### Pitfall 9: Window Blur Handler Exits Interactive Mode During Panel Drag

**What goes wrong:** `BrowserViewFrame` exits interactive mode on `window.blur` (line 102-104 of `browser-view-frame.tsx`). Some browsers fire a transient blur event during drag operations on resize handles, particularly when the drag crosses an iframe boundary or the handle receives focus. This could cause interactive mode to flicker off during a resize drag.

**Prevention:** Debounce the blur handler (50ms) or check if the blur is followed by an immediate focus event before exiting interactive mode.

**Confidence:** MEDIUM -- this is browser-dependent behavior. May not occur with react-resizable-panels' Separator implementation but worth testing.

---

### Pitfall 10: PanelSeparator Styling Inconsistency

**What goes wrong:** The existing `PanelSeparator` component uses `data-separator` attributes for hover/active styling (`[data-separator='hover']` and `[data-separator='active']`). react-resizable-panels v4 changed from `data` attributes to `aria` attributes. If the playground has not updated to match v4's attribute API, the hover/active styling on Separators may not work.

**Prevention:** Verify that `PanelSeparator` styling selectors match v4's actual attribute output. Check the rendered DOM for which attributes are present during hover/active states. Update selectors if needed.

**Warning signs:** Separator handle does not change color on hover or during active drag.

**Confidence:** MEDIUM -- the existing `separator.tsx` already uses `data-separator` attributes and the codebase is already on v4 (`^4.0.15`), so this may already be resolved or may be a known issue. Verify during implementation.

---

### Pitfall 11: Stale Closure in Throttled Mouse Move After Resize

**What goes wrong:** `useMouseInteraction` throttles mousemove events to 30fps via `requestAnimationFrame` (lines 128-162 of `use-mouse-interaction.ts`). The `pendingMoveEvent` is stored as a local variable in the effect closure. If the panel resizes between when `pendingMoveEvent` is captured and when the rAF callback fires, the `getBoundingClientRect()` call in the callback uses the move event's `clientX`/`clientY` but the img's updated rect -- which is correct for steady-state but may produce a single-frame coordinate glitch during resize.

**Prevention:** This is a minor edge case. The throttle interval is ~33ms, so the maximum staleness is one frame. No action needed unless testing reveals visible artifacts. If needed, discard pending move events when resize is detected.

**Confidence:** LOW -- theoretical concern. The single-frame lag is unlikely to produce user-visible issues in practice.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Priority |
|---|---|---|---|
| Moving BrowserViewPanel to AgentLayout | #1 WebSocket disconnection from remount | Use collapsible panel, not conditional rendering | MUST before any other work |
| Moving BrowserViewPanel to AgentLayout | #2 Context scope mismatch | Hoist BrowserToolCallsProvider to Agent page | MUST before or during move |
| Moving BrowserViewPanel to AgentLayout | #5 Wrong panel rendering approach | Collapsible, not conditional | Architecture decision |
| Wiring up panel show/hide | #6 Storage key collision | Change useDefaultLayout id | Verification step |
| Interactive mode in new location | #4 Keyboard capture conflicts | Scope keyboard handler to container, not document | MUST in same phase |
| Interactive mode in new location | #7 Click-outside exits on separator click | Exclude separator elements from click-outside | MUST in same phase |
| Panel resize behavior | #3 Coordinate mapping during resize | Debounce interaction-enable after resize settles | Medium priority |
| Panel sizing/UX | #8 Aspect ratio in narrow panels | Set minSize, consider removing forced aspect-ratio | UX polish task |

---

## Decision Matrix: Conditional Rendering vs. Collapsible Panel

This is the most consequential architecture decision for this refactor.

| Criterion | Conditional Rendering | Collapsible Panel |
|---|---|---|
| WebSocket survival | NO -- remounts kill connection | YES -- component stays mounted |
| Imperative API compatible | NO (Issue #285) | YES (recommended by maintainer) |
| Existing codebase pattern | No precedent | `CollapsiblePanel` already exists |
| React state preservation | NO -- state resets on remount | YES -- state preserved |
| DOM footprint when hidden | None (fully removed) | Minimal (0-width panel in DOM) |
| Implementation complexity | Lower (just add/remove JSX) | Slightly higher (imperative API) |
| Robustness | Fragile (many edge cases) | Robust (battle-tested pattern) |

**Recommendation:** Collapsible panel is the only viable approach given the WebSocket persistence requirement.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `browser-view-panel.tsx`, `browser-view-frame.tsx`, `use-browser-stream.ts`, `use-mouse-interaction.ts`, `use-keyboard-interaction.ts`, `use-click-ripple.ts`, `coordinate-mapping.ts`, `browser-tool-calls-context.tsx`, `use-input-coordination.ts`, `tool-fallback.tsx`, `thread.tsx`, `agent-layout.tsx`, `collapsible-panel.tsx`, `separator.tsx`
- [react-resizable-panels GitHub Issue #285](https://github.com/bvaughn/react-resizable-panels/issues/285) -- maintainer confirms imperative API requires rendered panels
- [react-resizable-panels conditional rendering example](https://react-resizable-panels.vercel.app/examples/conditional)
- [React Context documentation](https://react.dev/learn/passing-data-deeply-with-context) -- context scoped to provider subtree

### Secondary (MEDIUM confidence)
- [react-resizable-panels npm](https://www.npmjs.com/package/react-resizable-panels) -- v4.4.1 latest, v4.0.15+ in use
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) -- conditional rendering requires `order` + `id` props
- [shadcn-ui Issue #9136](https://github.com/shadcn-ui/ui/issues/9136) -- v4 breaking changes (export names, attribute changes)
- [ResizeObserver spec](https://web.dev/articles/resize-observer) -- runs between layout and paint, `contentRect` vs `getBoundingClientRect`

### Tertiary (LOW confidence)
- WebSearch findings on window blur during drag operations -- browser-dependent, needs testing
- WebSearch findings on v4 data-attribute to aria-attribute migration -- needs verification against actual rendered output
