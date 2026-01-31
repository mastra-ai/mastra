# Feature Landscape: Split-Pane Browser View Layout

**Domain:** Side-by-side chat + browser layout for Mastra Studio
**Researched:** 2026-01-30
**Confidence:** HIGH
**Milestone:** Replace floating overlay with split-pane layout (chat left, browser right)

## Context

### The Problem

The current browser view is an absolutely-positioned floating overlay inside the chat scroll area:

```
// Current: browser-view-panel.tsx line 80
'absolute top-4 left-0 z-10 max-w-3xl w-full px-4'
```

This overlay covers chat messages when the browser is active. Team feedback: "the current floating overlay hides chat messages." The fix is a side-by-side split-pane layout with chat on the left, browser on the right. The browser panel should be hidden when no browser session exists and collapsible when one does.

### What Already Exists

| Component | Status | Relevance |
|-----------|--------|-----------|
| `AgentLayout` | EXISTS | Already uses `react-resizable-panels` with `leftSlot`, `rightSlot` props. `rightSlot` uses `CollapsiblePanel` with `direction="right"`, `minSize={300}`, `maxSize={'50%'}`, `defaultSize="30%"`. |
| `CollapsiblePanel` | EXISTS | Wraps `react-resizable-panels` Panel with collapse/expand toggle button, `onResize` listener that tracks collapsed state. |
| `PanelSeparator` | EXISTS | Styled resize handle with hover/active states. |
| `BrowserViewPanel` | EXISTS | Manages browser panel visibility, collapse, close, and status. Currently uses absolute positioning. |
| `BrowserViewFrame` | EXISTS | Renders screencast img with input injection handlers, interactive mode, click ripple, agent busy overlay. Never unmounts (stable WebSocket). |
| `BrowserViewHeader` | EXISTS | URL bar, status badge, collapse toggle, close button. |
| `BrowserToolCallHistory` | EXISTS | Collapsible tool call history below the frame. |
| `useDefaultLayout` hook | EXISTS | From `react-resizable-panels`, persists layout sizes to localStorage. |
| `react-resizable-panels` | v4.0.15+ | Already a dependency. Supports collapsible panels, conditional rendering with `id`/`order` props, imperative API (`collapse()`, `expand()`, `isCollapsed()`, `resize()`). |

### Critical Constraint: WebSocket Stability

The `BrowserViewFrame` comment (line 19) states:

> "Renders a single BrowserViewFrame instance that never unmounts. This keeps the WebSocket connection stable across visibility/collapse toggles and prevents screencast stop/start churn on the server."

Any layout change MUST preserve this invariant. The frame component cannot be conditionally rendered (mount/unmount) based on panel visibility. It must always be in the React tree, with CSS hiding it when the panel is collapsed or no session exists.

---

## Table Stakes

Features users expect when switching from a floating overlay to a split-pane layout. Without these, the layout feels broken or regresses from the overlay.

### TS-1: Side-by-Side Layout (Chat Left, Browser Right)

| Aspect | Detail |
|--------|--------|
| **What** | Chat conversation fills the left panel, browser view fills the right panel. Both visible simultaneously when a browser session is active. |
| **Why expected** | This is the core ask. The entire reason for the milestone. Every comparable tool (OpenAI Operator, Claude Artifacts, Cursor, VS Code) uses this pattern. |
| **Complexity** | Low |
| **Dependencies** | `AgentLayout` rightSlot (already implemented), `react-resizable-panels` (already installed) |

**Implementation approach:** Move `BrowserViewPanel` from inside the Thread component (absolute overlay) to the `AgentLayout`'s `rightSlot` prop. The AgentLayout already renders a right CollapsiblePanel with a PanelSeparator when `rightSlot` is provided.

**Current rendering hierarchy:**
```
AgentLayout (react-resizable-panels Group)
  +-- leftSlot (optional, e.g., thread list)
  +-- main-slot (Panel)
  |     +-- Thread
  |           +-- chat messages
  |           +-- BrowserViewPanel (absolute overlay -- THIS MOVES)
  |           +-- Composer
  +-- rightSlot (optional, currently unused for browser agents)
```

**Target rendering hierarchy:**
```
AgentLayout (react-resizable-panels Group)
  +-- leftSlot (optional, e.g., thread list)
  +-- main-slot (Panel)
  |     +-- Thread
  |           +-- chat messages
  |           +-- Composer
  +-- rightSlot (conditionally populated with BrowserViewPanel)
      +-- BrowserViewPanel (inside CollapsiblePanel)
            +-- BrowserViewHeader
            +-- BrowserViewFrame
            +-- BrowserToolCallHistory
```

**Industry pattern:**
- OpenAI Operator: Chat on left, live browser on right. The pattern is described as "the emerging dominant UI design for AI agents."
- Claude Artifacts: Chat on left, artifact panel on right. Panel appears when artifact is generated, dismissable with X.
- ChatGPT Canvas: Chat on left, editable canvas on right.
- Cursor IDE: Chat panel alongside code editor, using VS Code's panel system.

### TS-2: Drag-to-Resize Handle Between Panels

| Aspect | Detail |
|--------|--------|
| **What** | A draggable divider between the chat and browser panels that allows the user to adjust the relative widths. |
| **Why expected** | Users need different amounts of screen for chat vs. browser depending on their task. A fixed split is unusable for people on smaller screens. Every split-pane tool provides this. |
| **Complexity** | Already done (Low) |
| **Dependencies** | `PanelSeparator` (already exists), `react-resizable-panels` Separator component |

**Implementation approach:** Already implemented via `PanelSeparator`. When `rightSlot` is provided to `AgentLayout`, a `<PanelSeparator />` is rendered between the main and right panels. No new work needed beyond what TS-1 provides.

**Existing configuration (AgentLayout):**
```
minSize={300}    // Right panel minimum 300px
maxSize={'50%'}  // Right panel max 50% of viewport
defaultSize="30%" // Right panel starts at 30%
```

These values may need adjustment for browser view (browser content benefits from more width).

### TS-3: Auto-Show on Browser Session Start

| Aspect | Detail |
|--------|--------|
| **What** | The browser panel appears automatically when a browser session starts streaming (first screencast frame arrives). The user does not need to manually open a panel. |
| **Why expected** | Current overlay already auto-shows when status changes to `streaming`. Losing this behavior would be a regression. Users watching an agent should see the browser appear without extra interaction. |
| **Complexity** | Medium |
| **Dependencies** | Browser stream status propagation from `BrowserViewFrame` to the layout level |

**Current behavior (preserved):** BrowserViewPanel line 35: `if (newStatus === 'streaming') { setIsVisible(true); }`. This must continue to work, but now "visible" means the right panel expands/appears rather than an overlay showing.

**Implementation challenge:** The `BrowserViewPanel` currently manages its own visibility state internally. In the split-pane layout, visibility is a concern of the `AgentLayout` (which controls whether `rightSlot` is populated or whether the right panel is collapsed/expanded). This requires lifting visibility state up or using an imperative panel API to programmatically expand/collapse the right panel.

**Two approaches:**
1. **State lifting:** BrowserViewPanel emits `onBrowserActive(boolean)` callback. Parent (or context) uses this to set `rightSlot` content or call `panelRef.expand()`.
2. **Context-based:** A shared `BrowserPanelContext` that both the frame and the layout subscribe to. Frame sets `isActive`, layout reads it and expands/collapses accordingly.

**Industry pattern:**
- Claude Artifacts: Panel auto-appears when an artifact is generated. No manual "open panel" action needed.
- ChatGPT Canvas: Canvas auto-opens when AI determines content is complex enough to warrant it.

### TS-4: Close Button Dismisses Panel (Closes Browser Session)

| Aspect | Detail |
|--------|--------|
| **What** | The X button on the browser panel header dismisses the panel and closes the browser session. The right panel collapses or hides entirely. |
| **Why expected** | Current overlay already has this behavior. Losing it is a regression. Users must be able to dismiss the browser view when they no longer need it. |
| **Complexity** | Low |
| **Dependencies** | `BrowserViewHeader` close button (already exists), imperative panel API for collapse |

**Current behavior (preserved):** BrowserViewPanel line 49: `handleClose` sets `isVisible(false)` and calls `/api/agents/${agentId}/browser/close`. In split-pane, this should also collapse the right panel via `panelRef.current.collapse()`.

### TS-5: Collapse/Expand Toggle (Without Closing Session)

| Aspect | Detail |
|--------|--------|
| **What** | User can collapse the browser panel to a minimal width (showing only a header or an expand button) without closing the browser session. Expanding it restores the previous width. |
| **Why expected** | Users may want to temporarily focus on chat without losing the browser session. The current overlay supports collapse via chevron button. Split pane collapse is the natural equivalent. |
| **Complexity** | Already done (Low) |
| **Dependencies** | `CollapsiblePanel` (already exists), imperative API `collapse()`/`expand()` |

**Implementation approach:** The existing `CollapsiblePanel` component handles this. When the user drags the separator past the `minSize` threshold, or clicks a collapse button, the panel collapses to `collapsedSize={60}` (showing an expand arrow). The `BrowserViewFrame` remains mounted but its container is `display: none` or `overflow: hidden` when collapsed. WebSocket stays connected.

**Critical detail:** When collapsed, the `BrowserViewFrame` img element is effectively hidden but not unmounted. The `onFrame` handler continues updating `imgRef.current.src` (no visual cost since the element is not painted). When expanded, the latest frame is immediately visible with no flash or reload.

### TS-6: Hidden When No Browser Session

| Aspect | Detail |
|--------|--------|
| **What** | When no browser session exists (status is `idle`, no agent has launched a browser), the right panel is not shown at all. The chat takes the full width. |
| **Why expected** | Most agents do not use browser tools. Showing an empty panel would waste screen space and confuse users. Claude Artifacts panel only appears when there is an artifact. Same principle. |
| **Complexity** | Medium |
| **Dependencies** | Browser session state detection, `react-resizable-panels` conditional rendering |

**Implementation approaches:**

**Option A (Recommended): Conditional rightSlot**
```
<AgentLayout rightSlot={hasBrowserSession ? <BrowserViewPanel /> : undefined}>
```
When `rightSlot` is undefined, `AgentLayout` does not render the right panel or separator at all. Chat gets 100% width. When browser starts, `hasBrowserSession` becomes true, `rightSlot` populates, and the right panel appears.

**Caveat with Option A:** `react-resizable-panels` requires `id` and `order` props on conditionally rendered panels for stable layout persistence. The library's `autoSaveId` on PanelGroup stores separate layouts for each combination of visible panels.

**Option B: Always render, start collapsed at 0**
Always render the right panel with `collapsedSize={0}` and `defaultCollapsed={true}`. Use `panelRef.expand()` when browser starts. This avoids conditional rendering entirely but the panel separator is always present (even if invisible).

**Recommendation:** Option A because it is cleaner -- no phantom separator, no wasted layout calculations. The `react-resizable-panels` library explicitly supports conditional rendering (documented with examples at `react-resizable-panels.vercel.app/examples/conditional`).

**WebSocket stability concern:** With Option A, the `BrowserViewPanel` component unmounts when `rightSlot` becomes undefined (browser session ends / user closes). This is acceptable because closing the browser session already disconnects the WebSocket. The concern is the opposite direction: when the session starts, the panel mounts for the first time and `BrowserViewFrame` connects. There is no remount-during-active-session because once the panel is shown, it stays mounted until explicitly closed.

### TS-7: Layout Size Persistence

| Aspect | Detail |
|--------|--------|
| **What** | The user's chosen panel width ratio (e.g., 60/40 or 70/30) persists across page reloads and navigation. |
| **Why expected** | VS Code, Cursor, and every professional split-pane tool persists panel sizes. Having to re-drag the divider every time is a significant UX annoyance. |
| **Complexity** | Already done (Low) |
| **Dependencies** | `useDefaultLayout` hook (already used in AgentLayout), localStorage |

**Implementation approach:** Already implemented. `AgentLayout` uses `useDefaultLayout({ id: 'agent-layout-{agentId}', storage: localStorage })` which persists panel sizes. The `react-resizable-panels` `autoSaveId` feature stores layouts keyed by which panels are visible (via the `id` prop on each Panel).

---

## Differentiators

Features that would make the split-pane layout feel polished and professional. Not required for initial delivery, but elevate the UX beyond basic functionality.

### D-1: Smooth Panel Appear/Disappear Animation

| Aspect | Detail |
|--------|--------|
| **Value** | When the browser panel appears (session starts) or disappears (session closed), it slides in/out smoothly rather than popping in instantly. Prevents jarring layout shift. |
| **Complexity** | Medium |
| **Phase** | Include if straightforward, otherwise defer |

**Why valuable:** Instant layout changes are jarring. When the right panel appears, the chat panel suddenly shrinks from 100% to 60-70%. A 200-300ms animation makes this feel intentional.

**Implementation challenge:** `react-resizable-panels` does NOT natively support animated transitions. The library controls flex sizing imperatively (CSS `flex` property, no transitions). Issue #310 on the GitHub repo confirms this limitation.

**Workarounds:**
1. **CSS transition on panel content width** -- Apply `transition: width 200ms ease` on the inner content container, not on the flex panel itself. The panel flex changes instantly, but the content width transitions smoothly. This creates a partial visual effect.
2. **Incremental resize via requestAnimationFrame** -- Instead of `expand()`, call `resize(size)` with intermediate values over ~10 frames. This simulates animation but is hacky and creates jitter.
3. **Two-phase render** -- First show the panel at `collapsedSize`, then after one frame, call `expand()`. The collapsed-to-expanded transition is less jarring than nothing-to-expanded.
4. **Accept no animation** -- Many professional tools (VS Code, Cursor) do NOT animate panel splits. The panels appear and disappear instantly. This is acceptable.

**Recommendation:** Start without animation. If the instant appear feels too jarring, try the two-phase render approach (collapsed, then expand after requestAnimationFrame). Do NOT invest significant time on animation given the library's limitations.

### D-2: Responsive Breakpoint -- Stack on Narrow Viewports

| Aspect | Detail |
|--------|--------|
| **Value** | On narrow viewports (below ~1024px), automatically switch from side-by-side to stacked layout (chat on top, browser below) or collapse the browser panel to a collapsible overlay. |
| **Complexity** | High |
| **Phase** | Defer to future milestone |

**Why valuable:** Side-by-side layout requires sufficient horizontal space. Below ~1024px, both panels become too narrow to be usable (chat needs ~400px minimum, browser view needs ~300px minimum). Mobile/tablet users would see unusable panels.

**Implementation approaches:**
1. **Auto-collapse at breakpoint** -- Use `window.matchMedia('(max-width: 1024px)')` to detect narrow viewport. Automatically collapse the browser panel. User can still expand it, but chat takes priority.
2. **Layout mode switch** -- Below the breakpoint, render a stacked layout (vertical panels) instead of horizontal split. This requires a different `react-resizable-panels` Group configuration.
3. **Overlay fallback** -- Below the breakpoint, fall back to the current floating overlay behavior. The browser appears on top of chat instead of beside it.

**Industry pattern:**
- Ionic split-pane: Collapses below 992px by default, configurable via `when` prop.
- VS Code: Does not collapse -- expects a minimum window width. On narrow windows, panels become cramped.
- Claude: On mobile, artifacts show as a modal overlay instead of side-by-side.

**Recommendation:** For the initial milestone, set a minimum viewport width check. If viewport is below 1024px, show a warning or use the overlay fallback. Full responsive adaptation is a separate milestone.

### D-3: Double-Click Separator to Reset Width

| Aspect | Detail |
|--------|--------|
| **Value** | Double-clicking the resize handle resets the panel split to the default ratio (e.g., 70/30). Provides a quick escape from accidentally dragging the divider too far. |
| **Complexity** | Low |
| **Phase** | Include in initial delivery |

**Why valuable:** Users sometimes drag the divider and lose their preferred ratio. A double-click reset is a convention in many split-pane UIs (VS Code, macOS Finder column view, many IDEs).

**Implementation:** Add `onDoubleClick` handler to `PanelSeparator`. Use the PanelGroup imperative API `setLayout(defaultLayout)` to reset to default sizes.

### D-4: Keyboard Shortcut to Toggle Browser Panel

| Aspect | Detail |
|--------|--------|
| **Value** | A keyboard shortcut (e.g., `Cmd+B` or `Cmd+Shift+B`) toggles the browser panel open/closed. Power users can quickly hide/show the browser without reaching for the mouse. |
| **Complexity** | Low |
| **Phase** | Include in initial delivery |

**Why valuable:** Developer tools rely heavily on keyboard shortcuts. Cursor, VS Code, and most IDEs support keyboard-driven panel toggling. Agent debugging workflows benefit from fast panel switching.

**Implementation:** Add a global keyboard listener (or hook into existing shortcut system) that calls `panelRef.current.isCollapsed() ? panelRef.current.expand() : panelRef.current.collapse()`.

**Industry pattern:**
- VS Code: `Cmd+B` toggles sidebar, `Cmd+J` toggles bottom panel.
- Cursor: Keyboard shortcuts for all panel positions.
- Claude: No keyboard shortcut for artifacts panel (not a developer tool).

### D-5: "Last Frame" Snapshot on Session End

| Aspect | Detail |
|--------|--------|
| **Value** | When the browser session ends (browser_closed status), the panel continues showing the last captured frame as a static image instead of immediately hiding or going blank. User can see the final state of the browser before dismissing. |
| **Complexity** | Already done (Low) |
| **Phase** | Current behavior -- preserve it |

**Current behavior:** BrowserViewPanel already preserves the last frame. The panel stays visible with the final frame when `browser_closed` status arrives. User dismisses via X button. This behavior must be preserved in the split-pane layout.

### D-6: Panel Header Shows Browser URL with Copy Button

| Aspect | Detail |
|--------|--------|
| **Value** | The browser panel header shows the current page URL (already done) plus a copy-to-clipboard button. Useful when the user wants to open the same page in their own browser. |
| **Complexity** | Low |
| **Phase** | Include in initial delivery |

**Current behavior:** `BrowserViewHeader` already displays the URL. Adding a copy button is a minor enhancement.

### D-7: Right Panel Min/Max Size Tuning for Browser Content

| Aspect | Detail |
|--------|--------|
| **Value** | Adjust the right panel `minSize`, `maxSize`, and `defaultSize` to be optimal for browser content rather than generic sidebar content. |
| **Complexity** | Low |
| **Phase** | Include in initial delivery |

**Current AgentLayout values:**
```
minSize={300}     // 300px minimum -- may be too narrow for browser view
maxSize={'50%'}   // 50% max -- may be too restrictive for debugging
defaultSize="30%" // 30% default -- may be too narrow for browser view
```

**Recommended values for browser panel:**
```
minSize={400}     // 400px minimum -- browser content needs more width for usable interaction
maxSize={'60%'}   // 60% max -- allow user to expand browser view for detail work
defaultSize="40%" // 40% default -- balanced split, browser view is the focus when shown
```

**Rationale:** The screencast renders at 1280x720 viewport. At 30% of a 1440px screen, the browser panel is 432px -- the screencast image displays at roughly 1/3 its native resolution. At 40%, it is 576px -- still scaled but more usable for clicking small UI elements. For input injection (clicking CAPTCHAs, typing in forms), more width means better coordinate mapping precision.

---

## Anti-Features

Features to deliberately NOT build for this milestone. These add complexity without proportional value or create UX problems.

### AF-1: Floating Panel Mode (Detachable / Popout)

| Aspect | Detail |
|--------|--------|
| **What** | Allowing the browser panel to be detached from the split layout and floated as a draggable window or popped out to a separate browser window. |
| **Why avoid** | Significantly increases complexity (drag-and-drop panel management, position persistence, popout requires new window with WebSocket reconnection). No comparable tool does this for browser agent views. VS Code supports panel positions but not arbitrary floating. |
| **What instead** | Fixed side-by-side layout with collapse. Users who want a separate view can open the raw browser URL in another tab (if we add the URL copy feature, D-6). |

### AF-2: Multi-Panel Layout (More Than Two Panels)

| Aspect | Detail |
|--------|--------|
| **What** | Supporting multiple right-side panels simultaneously (e.g., browser view + tool call history + network log as separate panels). |
| **Why avoid** | Exponential complexity in layout management. The browser panel already contains tool call history as a collapsible section. Adding more panels fragments screen space and confuses the layout hierarchy. |
| **What instead** | Keep tool call history, status indicators, and other browser metadata as collapsible sections WITHIN the browser panel. One right panel, multiple sections inside it. |

### AF-3: Panel Position Customization (Left/Right/Bottom)

| Aspect | Detail |
|--------|--------|
| **What** | Letting users choose whether the browser panel appears on the right, left, or bottom of the chat. |
| **Why avoid** | Cursor IDE has significant UX bugs from allowing panel position customization (documented in GitHub issues #3748, #731, #1585). Position changes affect layout persistence, break keyboard shortcuts, and create confusing state. The convention is chat-left, artifact/browser-right. |
| **What instead** | Fixed position: chat left, browser right. This matches OpenAI Operator, Claude Artifacts, and ChatGPT Canvas. Consistency trumps flexibility here. |

### AF-4: Picture-in-Picture Mode

| Aspect | Detail |
|--------|--------|
| **What** | A small floating thumbnail of the browser view that follows the user as they scroll through chat, similar to YouTube PiP. |
| **Why avoid** | The split-pane layout makes this unnecessary -- the browser view is always visible in the right panel while the user scrolls chat in the left panel. PiP was useful for the overlay (which scrolled away), but is redundant with side-by-side layout. |
| **What instead** | The side-by-side layout itself solves the "browser disappears when I scroll" problem. |

### AF-5: Drag Panels to Reorder

| Aspect | Detail |
|--------|--------|
| **What** | Allowing users to drag the browser panel to reorder it relative to the chat panel (swap positions). |
| **Why avoid** | Adds drag-and-drop complexity, breaks layout persistence assumptions, creates confusing UX when combined with collapse/expand behavior. VS Code supports this for editor groups but it causes significant UX issues (auto-resize on focus, documented in issue #125997). |
| **What instead** | Fixed order: chat left, browser right. Always. |

### AF-6: Animated Slide-In with Spring Physics

| Aspect | Detail |
|--------|--------|
| **What** | Implementing a smooth spring-animation (framer-motion style) when the browser panel appears or disappears. |
| **Why avoid** | `react-resizable-panels` does not support animated transitions natively (confirmed in issue #310). Working around this requires either (a) a parallel animation system that fights with the library's flex sizing, or (b) replacing `react-resizable-panels` entirely with a custom implementation. Both are high cost for marginal UX gain. |
| **What instead** | Accept instant panel appear/disappear. This is what VS Code, Cursor, and most developer tools do. If absolutely needed, use the two-phase render approach (collapsed -> expand after one frame) as a lightweight alternative. |

---

## Feature Dependencies

```
Existing infrastructure
    |
    +---> AgentLayout with rightSlot prop           [EXISTS, uses react-resizable-panels]
    +---> CollapsiblePanel component                [EXISTS, collapse/expand/onResize]
    +---> PanelSeparator component                  [EXISTS, styled drag handle]
    +---> BrowserViewPanel (overlay mode)           [EXISTS, needs repositioning]
    +---> BrowserViewFrame (WebSocket + screencast) [EXISTS, must not unmount]
    +---> react-resizable-panels v4.0.15+           [EXISTS, supports conditional panels]
    +---> useDefaultLayout (localStorage persist)   [EXISTS, layout persistence]
    |
    v
Split-Pane Layout (this milestone)
    |
    +---> [TS-1] Side-by-side layout                (Foundation -- move BrowserViewPanel to rightSlot)
    |         |
    |         +---> [TS-2] Resize handle            (Comes for free with TS-1 via PanelSeparator)
    |         +---> [TS-7] Layout size persistence  (Comes for free with TS-1 via useDefaultLayout)
    |         +---> [D-7] Min/max size tuning       (Configuration change on CollapsiblePanel props)
    |
    +---> [TS-3] Auto-show on session start         (Requires state lifting or context)
    |         |
    |         +---> [TS-6] Hidden when no session   (Inverse of TS-3 -- conditional rightSlot)
    |
    +---> [TS-4] Close button dismisses panel       (Extends existing close handler with panel collapse)
    |
    +---> [TS-5] Collapse/expand toggle             (Comes for free with CollapsiblePanel)
    |
    +---> [D-1]  Smooth animation                   (Independent, low priority, library limitation)
    +---> [D-3]  Double-click reset                 (Independent, separator enhancement)
    +---> [D-4]  Keyboard shortcut toggle           (Independent, global listener)
    +---> [D-5]  Last frame on session end          (Already implemented, just preserve it)
    +---> [D-6]  URL copy button                    (Independent, header enhancement)
```

**Build order implication:**

1. **State management first** -- Decide how browser session state propagates from `BrowserViewFrame` (deep in the component tree) to `AgentLayout` (the top-level layout). This is the architectural decision that gates everything else.

2. **Move BrowserViewPanel to rightSlot** -- The main layout change. Remove the absolute-positioned overlay from `thread.tsx`, pass `BrowserViewPanel` as `rightSlot` to `AgentLayout`.

3. **Conditional rendering** -- Implement "show when browser active, hide when not" using `react-resizable-panels` conditional panel support.

4. **Polish** -- Size tuning, keyboard shortcuts, URL copy, double-click reset.

---

## Assist Mode Interaction with Split-Pane Layout

The split-pane layout changes how the user interacts with the browser view during input injection (v1.2 features). Key interaction changes:

### Focus Management Across Panels

In the overlay, the browser view is inside the chat scroll area. Clicking the browser view and clicking chat messages are clicks within the same container. In split-pane, they are in separate panels.

**Implication:** Focus management becomes cleaner. Clicking in the left panel (chat) naturally exits interactive mode in the right panel (browser). The panel boundary creates a natural focus boundary.

**Specific behavior:**
- Clicking in the browser panel enters interactive mode (keyboard capture)
- Clicking in the chat panel (to type a message) exits interactive mode
- The panel separator acts as a natural boundary between focus zones
- Escape key in browser panel exits interactive mode (already implemented)

### Coordinate Mapping with Variable Panel Width

The browser panel width is now variable (user can resize). The `BrowserViewFrame` uses `object-contain` on the img element, which scales the screencast to fit the available width while preserving aspect ratio.

**Implication:** Coordinate mapping (already implemented) continues to work correctly because it is based on the img element's `getBoundingClientRect()` at click time, not on a fixed panel width. As the user resizes the panel, the img element resizes, and the coordinate mapping adapts automatically.

### Agent Busy Overlay Positioning

The `AgentBusyOverlay` is currently positioned `absolute` within the `BrowserViewFrame` container. In split-pane, this continues to work because the overlay is relative to the frame container, not to the viewport.

---

## Competitive Landscape (Split-Pane Layout)

| Feature | OpenAI Operator | Claude Artifacts | ChatGPT Canvas | Cursor IDE | VS Code | Our Target |
|---------|----------------|-----------------|----------------|------------|---------|------------|
| Side-by-side layout | Yes (chat + browser) | Yes (chat + artifact) | Yes (chat + editor) | Yes (chat + code) | Yes (editor + preview) | Yes |
| Resize handle | No (fixed split) | No (fixed split) | No (fixed split) | Yes (VS Code inherited) | Yes | Yes |
| Auto-show on activity | Yes (auto-opens) | Yes (auto-opens) | Yes (auto-opens) | Partial | N/A | Yes |
| Close/dismiss | Not closeable | Yes (X button) | Not closeable | Yes | Yes | Yes |
| Collapse without close | No | No | No | Yes | Yes | Yes |
| Layout persistence | N/A | N/A | N/A | Yes | Yes | Yes |
| Animation on show | Minimal/none | Subtle slide-in | Subtle slide-in | None | None | None (acceptable) |
| Keyboard toggle | No | No | No | Yes | Yes | Yes |
| Responsive collapse | Mobile: different UI | Mobile: overlay | Mobile: different UI | No | No | Defer |

**Our positioning:** We offer more control than Operator/Claude/Canvas (resize, collapse, persist, keyboard shortcut) while keeping the simplicity of the established chat-left, browser-right pattern. The `react-resizable-panels` library gives us IDE-quality panel behavior that consumer AI products (Operator, Claude) do not provide.

---

## MVP Recommendation

### Must Have (Ship Blockers)

1. **Side-by-side layout** (TS-1) -- core layout change
2. **Resize handle** (TS-2) -- already exists via PanelSeparator
3. **Auto-show on session start** (TS-3) -- prevents regression from overlay
4. **Close button dismisses** (TS-4) -- prevents regression from overlay
5. **Collapse/expand toggle** (TS-5) -- already exists via CollapsiblePanel
6. **Hidden when no session** (TS-6) -- prevents wasted space for non-browser agents
7. **Layout size persistence** (TS-7) -- already exists via useDefaultLayout

### Should Have (Include If Straightforward)

8. **Panel min/max size tuning** (D-7) -- config change, low effort
9. **Keyboard shortcut toggle** (D-4) -- low complexity, power user value
10. **URL copy button** (D-6) -- low complexity, useful utility
11. **Double-click separator reset** (D-3) -- low complexity, standard UX pattern
12. **Last frame on session end** (D-5) -- already implemented, just preserve it

### Defer (Future Milestone)

13. **Smooth animation** (D-1) -- library limitation, medium complexity for marginal value
14. **Responsive breakpoint stacking** (D-2) -- high complexity, affects entire layout system

---

## Sources

### Primary (HIGH confidence)

- **Codebase inspection:** `packages/playground-ui/src/domains/agents/components/agent-layout.tsx` -- AgentLayout with rightSlot, CollapsiblePanel, useDefaultLayout, react-resizable-panels integration
- **Codebase inspection:** `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-panel.tsx` -- Current overlay positioning, visibility management, close handler
- **Codebase inspection:** `packages/playground-ui/src/lib/ai-ui/thread.tsx` -- BrowserViewPanel rendered inside Thread as absolute overlay
- **Codebase inspection:** `packages/playground-ui/src/lib/resize/collapsible-panel.tsx` -- CollapsiblePanel with imperative API, collapse/expand state
- **react-resizable-panels** v4.0.15+ (already installed): [GitHub](https://github.com/bvaughn/react-resizable-panels) -- Conditional rendering support, imperative API (collapse/expand/resize/isCollapsed), `id`/`order` props, `autoSaveId` for layout persistence. [Issue #310](https://github.com/bvaughn/react-resizable-panels/issues/310) confirms no native animation support. [Conditional example](https://react-resizable-panels.vercel.app/examples/conditional) documents pattern.

### Secondary (MEDIUM confidence)

- **Emerge Haus Blog:** [The New Dominant UI Design for AI Agents](https://www.emerge.haus/blog/the-new-dominant-ui-design-for-ai-agents) -- Documents convergence on chat-left, action-right split-pane layout across AI agent UIs (Operator, Manus, etc.)
- **UX Collective:** [Where should AI sit in your UI?](https://uxdesign.cc/where-should-ai-sit-in-your-ui-1710a258390e) -- F-shaped scan pattern, chat-left for continuous access, canvas-right for working space
- **VS Code Custom Layout docs:** [code.visualstudio.com](https://code.visualstudio.com/docs/configure/custom-layout) -- Split pane resize behavior, orientation toggle, no animation on split
- **Browserbase Live View docs:** [docs.browserbase.com](https://docs.browserbase.com/features/session-live-view) -- iframe embedding, navbar control, disconnection handling
- **OpenAI Operator:** [openai.com/index/introducing-operator](https://openai.com/index/introducing-operator/) -- Chat + browser side-by-side, takeover mode
- **Workday Canvas Side Panel:** [canvas.workday.com](https://canvas.workday.com/components/containers/side-panel) -- Push vs overlay modes, responsive breakpoint collapse, expand/collapse transition states

### Tertiary (LOW confidence -- community patterns)

- **Cursor IDE issues:** [GitHub #3748](https://github.com/cursor/cursor/issues/3748) (panel position UX problems), [Forum](https://forum.cursor.com/t/cursor-chat-jump-between-editor-and-pane-when-send-content-to-chat/148813) (chat/editor panel jumping)
- **VS Code issue #125997:** [Stop auto resizing panes when focused](https://github.com/microsoft/vscode/issues/125997) -- Auto-resize on focus is a UX pain point
- **react-resizable-panels discussions:** [#285 conditional rendering](https://github.com/bvaughn/react-resizable-panels/issues/285), [#316 start collapsed](https://github.com/bvaughn/react-resizable-panels/discussions/316)

---

*Research completed: 2026-01-30*
*Focus: Split-pane layout features for browser view alongside chat in Mastra Studio*
