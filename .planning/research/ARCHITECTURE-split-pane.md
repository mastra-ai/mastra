# Architecture: Split-Pane Browser View Layout

**Researched:** 2026-01-30
**Domain:** React component architecture, react-resizable-panels v4 integration
**Confidence:** HIGH (based on direct codebase inspection and verified library API)

## Summary

The browser view currently lives as an absolutely positioned overlay inside Thread. Moving it to a dedicated panel in AgentLayout requires: (1) extracting BrowserViewPanel from Thread, (2) hoisting BrowserToolCallsProvider above AgentLayout so both Thread and the browser panel can access it, (3) creating a new BrowserSessionContext to share browser visibility/status state across the layout, (4) adding a conditional fourth panel to AgentLayout's react-resizable-panels Group, and (5) preserving the WebSocket never-unmount guarantee using collapsible panel mechanics rather than conditional React rendering.

**Primary recommendation:** Create a `BrowserSessionContext` that hoists browser visibility/status state to the AgentLayout level. Hoist `BrowserToolCallsProvider` above AgentLayout (from inside Thread). The browser panel uses `collapsible={true}` with `collapsedSize={0}` so its children stay mounted when hidden, preserving WebSocket stability.

## Current Architecture (Before)

### Component Hierarchy

```
Agent (page)
  TracingSettingsProvider
    AgentPromptExperimentProvider
      AgentSettingsProvider
        WorkingMemoryProvider
          ThreadInputProvider
            AgentLayout                    <-- react-resizable-panels Group
              leftSlot: AgentSidebar       <-- CollapsiblePanel
              children: AgentChat          <-- Panel (main-slot)
                MastraRuntimeProvider
                  Thread
                    BrowserToolCallsProvider   <-- wraps threadContent when agentId exists
                      ThreadWrapper
                        ThreadPrimitive.Root
                          ThreadPrimitive.Viewport
                            ThreadPrimitive.Messages
                              ToolFallback   <-- registers browser tool calls via context
                          BrowserViewPanel   <-- ABSOLUTE positioned overlay
                            BrowserViewHeader
                            BrowserViewFrame <-- WebSocket, never unmounts
                            BrowserToolCallHistory
                        Composer
              rightSlot: AgentInformation  <-- CollapsiblePanel
```

### Key Observations

1. **BrowserToolCallsProvider** wraps the entire `threadContent` JSX, including both `BrowserViewPanel` and the `ThreadPrimitive.Messages` that contain `ToolFallback` components. This is necessary because `ToolFallback` calls `useBrowserToolCallsSafe()` to register tool calls, and `BrowserToolCallHistory` calls `useBrowserToolCalls()` to read them.

2. **BrowserViewPanel** manages its own visibility via `useState`:
   - `isVisible` -- toggled on when `status === 'streaming'`, off on close
   - `isCollapsed` -- toggles header-only mode
   - `isClosing` -- debounce guard for close API call
   - When hidden: `fixed -left-[9999px] -top-[9999px] w-0 h-0 overflow-hidden`
   - When visible: `absolute top-4 left-0 z-10 max-w-3xl w-full px-4`

3. **BrowserViewFrame** holds the WebSocket connection via `useBrowserStream`. The hook stores the WebSocket in a `useRef` and has auto-reconnect with exponential backoff. **Unmounting kills the connection.** The cleanup effect in `useBrowserStream` explicitly closes the socket on unmount:
   ```typescript
   useEffect(() => {
     return () => {
       clearReconnectTimeout();
       if (wsRef.current) {
         wsRef.current.close();
         wsRef.current = null;
       }
     };
   }, [clearReconnectTimeout]);
   ```

4. **Data flow for tool call registration:**
   ```
   ToolFallback (inside ThreadPrimitive.Messages)
     -> useBrowserToolCallsSafe()
     -> browserCtx.registerToolCall(...)

   BrowserToolCallHistory (inside BrowserViewPanel)
     -> useBrowserToolCalls()
     -> reads toolCalls array

   BrowserViewFrame (inside BrowserViewPanel)
     -> useInputCoordination()
     -> useBrowserToolCalls() -> derives isAgentBusy
   ```

5. **AgentLayout** uses react-resizable-panels v4 `Group`, `Panel`, `CollapsiblePanel`, and `PanelSeparator`. The layout currently has 3 slots: left (sidebar), main (chat), right (info). Layout persistence uses `useDefaultLayout` with `localStorage`.

### Critical File Locations

| File | Path | Role |
|------|------|------|
| AgentLayout | `packages/playground-ui/src/domains/agents/components/agent-layout.tsx` | Panel group container |
| Thread | `packages/playground-ui/src/lib/ai-ui/thread.tsx` | Chat + browser view host |
| BrowserViewPanel | `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-panel.tsx` | Browser view orchestrator |
| BrowserViewFrame | `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx` | WebSocket + screencast |
| BrowserToolCallsContext | `packages/playground-ui/src/domains/agents/context/browser-tool-calls-context.tsx` | Tool call registry |
| use-browser-stream | `packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts` | WebSocket management |
| use-input-coordination | `packages/playground-ui/src/domains/agents/hooks/use-input-coordination.ts` | Derived busy state |
| ToolFallback | `packages/playground-ui/src/lib/ai-ui/tools/tool-fallback.tsx` | Registers browser tool calls |
| Agent page | `packages/playground/src/pages/agents/agent/index.tsx` | Assembles layout slots |
| CollapsiblePanel | `packages/playground-ui/src/lib/resize/collapsible-panel.tsx` | Resize wrapper |

---

## Target Architecture (After)

### Component Hierarchy

```
Agent (page)
  TracingSettingsProvider
    AgentPromptExperimentProvider
      AgentSettingsProvider
        WorkingMemoryProvider
          ThreadInputProvider
            BrowserToolCallsProvider        <-- HOISTED from inside Thread
              BrowserSessionProvider        <-- NEW: hoisted session state
                AgentLayout                 <-- Group now has 4 potential slots
                  leftSlot: AgentSidebar    <-- CollapsiblePanel (unchanged)
                  children: AgentChat       <-- Panel main-slot (unchanged)
                    MastraRuntimeProvider
                      Thread                <-- NO LONGER contains BrowserViewPanel
                        ThreadWrapper
                          ...messages...
                            ToolFallback    <-- still finds BrowserToolCallsContext (ancestor)
                        Composer
                  browserSlot: BrowserViewPanel  <-- MOVED here (adapted)
                    BrowserViewHeader
                    BrowserViewFrame        <-- never unmounts (collapsible panel)
                    BrowserToolCallHistory  <-- still finds BrowserToolCallsContext (ancestor)
                  rightSlot: AgentInformation  <-- CollapsiblePanel (unchanged)
```

### What Changes

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `BrowserSessionProvider` | **NEW** | Context providing `{isActive, status, show, hide, currentUrl}` |
| `BrowserSessionContext` | **NEW** | React context for session state |
| `useBrowserSession` | **NEW** | Consumer hook for reading session state |
| `AgentLayout` | **MODIFIED** | Accepts new `browserSlot` prop, renders conditional 4th panel |
| `Thread` | **MODIFIED** | Removes `BrowserViewPanel` rendering, removes `BrowserToolCallsProvider` wrapping |
| `BrowserViewPanel` | **MODIFIED** | No longer manages own visibility; reads from `BrowserSessionContext` |
| `BrowserViewFrame` | **UNCHANGED** | Stays identical; its parent just moves |
| `BrowserToolCallsProvider` | **HOISTED** | Moves from inside Thread to Agent page level (above AgentLayout) |
| `ToolFallback` | **UNCHANGED** | Still calls `useBrowserToolCallsSafe()` |
| Agent page | **MODIFIED** | Wraps layout in `BrowserToolCallsProvider` + `BrowserSessionProvider`, passes `browserSlot` |

---

## Detailed Design

### 1. BrowserSessionContext (New)

**Purpose:** Share browser session visibility state between Thread (where status originates) and AgentLayout (where the panel renders).

**Location:** `packages/playground-ui/src/domains/agents/context/browser-session-context.tsx`

```typescript
interface BrowserSessionContextValue {
  /** Whether the browser panel should be visible as a split pane */
  isActive: boolean;
  /** Current stream status from BrowserViewFrame */
  status: StreamStatus;
  /** Current URL being displayed */
  currentUrl: string | null;
  /** Show the browser panel */
  show: () => void;
  /** Hide the browser panel and close the browser session */
  hide: (agentId: string) => Promise<void>;
  /** Update status (called by BrowserViewFrame) */
  setStatus: (status: StreamStatus) => void;
  /** Update URL (called by BrowserViewFrame) */
  setCurrentUrl: (url: string | null) => void;
}
```

**Why a new context instead of extending BrowserToolCallsContext:**
- BrowserToolCallsContext has a narrow responsibility: tracking tool call entries. Mixing visibility/session lifecycle into it violates single responsibility.
- BrowserToolCallsContext uses `useBrowserToolCallsSafe()` as a null-check pattern for non-agent contexts. Session state does not need that pattern.
- Separate contexts allow independent evolution and testing.

**Auto-show behavior:** The `setStatus` callback in BrowserSessionProvider will contain the auto-show logic currently in BrowserViewPanel's `handleStatusChange`:
```typescript
const setStatus = useCallback((newStatus: StreamStatus) => {
  setStatusState(newStatus);
  if (newStatus === 'streaming') {
    setIsActive(true);
  }
}, []);
```

### 2. AgentLayout Changes

**Current signature:**
```typescript
interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}
```

**New signature:**
```typescript
interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  browserSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}
```

**Panel structure with browser slot:**

The browser panel inserts between `main-slot` and `right-slot`. It uses react-resizable-panels v4's conditional rendering support. Key requirements from the library (verified from types and WebSearch):

- Each conditional Panel MUST have a stable `id` prop
- An `order` prop is recommended for conditional panels to maintain correct DOM ordering
- The Group automatically persists separate layouts per combination of visible panels

```
Group
  [CollapsiblePanel id="left-slot" order={1}]    // if leftSlot
  [PanelSeparator]                                // if leftSlot
  [Panel id="main-slot" order={2}]                // always
  [PanelSeparator]                                // if browserSlot active
  [Panel id="browser-slot" order={3}]             // if browserSlot active
  [PanelSeparator]                                // if rightSlot
  [CollapsiblePanel id="right-slot" order={4}]    // if rightSlot
```

**Critical: The browser panel must NOT conditionally render its children.** The BrowserViewFrame inside must never unmount. Instead:

**Option A (Recommended): Collapsible panel with 0px collapsed size.**
- The browser panel is always in the DOM as a `CollapsiblePanel`
- When inactive: collapsed to `collapsedSize={0}`, `collapsible={true}`
- When active: expanded via `panelRef.current.expand()`
- BrowserViewFrame stays mounted at all times
- The `PanelImperativeHandle.collapse()` and `expand()` methods drive visibility

**Why Option A:** react-resizable-panels v4 `Panel` with `collapsedSize={0}` and `collapsible={true}` means the panel occupies zero visual space when collapsed but its React children remain mounted. This perfectly preserves the WebSocket. Verified from source: the Panel renders a `<div>` with `flexGrow: var(CSS_VARIABLE, 1)` and `flexShrink: 1` -- when collapsed, the CSS variable is set to 0, making the panel visually disappear while keeping React children in the DOM.

**Option B (Fallback): CSS hiding within always-rendered panel.**
- The browser panel always renders as a `Panel` in the Group
- When inactive: `minSize={0}`, content hidden via CSS (`overflow: hidden; width: 0;`)
- Problem: a zero-width non-collapsible panel still takes layout space and separator
- This approach is messier and less aligned with the library's design

**Recommendation: Use Option A.** The collapsible panel API is exactly designed for this use case.

### 3. BrowserViewPanel Adaptation

**Current:** Manages `isVisible`, `isCollapsed`, `isClosing` state internally. Uses absolute/fixed CSS positioning.

**After:** Reads `isActive` from `BrowserSessionContext`. No longer manages visibility state. Positioning changes from absolute to flowing panel content.

```typescript
// Before: manages own visibility
const [isVisible, setIsVisible] = useState(false);
// ...
return (
  <div className={isVisible ? 'absolute top-4 ...' : 'fixed -left-[9999px] ...'}>
```

```typescript
// After: reads from context, always renders normally
const { isActive, status, currentUrl, hide } = useBrowserSession();
// Panel visibility is controlled by parent CollapsiblePanel collapse/expand
return (
  <div className="flex flex-col h-full bg-surface2 overflow-hidden">
    <BrowserViewHeader ... />
    <div className="flex-1 p-2 min-h-0">
      <BrowserViewFrame ... />
    </div>
    <BrowserToolCallHistory />
  </div>
);
```

**The internal `isCollapsed` state (header-only toggle) can be preserved** as a local concern within BrowserViewPanel, independent of the panel-level collapse.

### 4. Hoisting BrowserToolCallsProvider

**The challenge:** `BrowserToolCallHistory` currently uses `useBrowserToolCalls()` and renders inside `BrowserViewPanel`. In the new architecture, `BrowserViewPanel` renders in `browserSlot`, which is a sibling panel to `main-slot` (where `AgentChat` / `Thread` lives). If `BrowserToolCallsProvider` stays inside Thread, then `BrowserToolCallHistory` would be OUTSIDE the provider and the `useBrowserToolCalls()` call would throw.

**Solution: Hoist `BrowserToolCallsProvider` above `AgentLayout`.**

This is safe because:
- `useBrowserToolCallsSafe()` in `ToolFallback` uses a null-check pattern -- it works whether the provider is a direct parent or a distant ancestor
- `useBrowserToolCalls()` in `BrowserToolCallHistory` requires the provider, and hoisting ensures it's available to both the Thread subtree and the browser panel subtree
- The provider has no dependency on `MastraRuntimeProvider` or `ThreadPrimitive` -- it's a standalone context with `useState` and `useCallback`
- There is only one Thread instance per agent page, so provider-per-Thread === provider-per-page. No state isolation concerns.

**Thread changes:** Remove the conditional `BrowserToolCallsProvider` wrapping:

```typescript
// Before (thread.tsx):
if (agentId) {
  return <BrowserToolCallsProvider>{threadContent}</BrowserToolCallsProvider>;
}
return threadContent;

// After (thread.tsx):
return threadContent;  // Provider is now above AgentLayout
```

**Agent page changes:** Add both providers around `AgentLayout`:

```typescript
// In packages/playground/src/pages/agents/agent/index.tsx:
<ThreadInputProvider>
  <BrowserToolCallsProvider>
    <BrowserSessionProvider>
      <AgentLayout agentId={agentId!} ... browserSlot={<BrowserViewPanel agentId={agentId!} />}>
        ...
      </AgentLayout>
    </BrowserSessionProvider>
  </BrowserToolCallsProvider>
</ThreadInputProvider>
```

### 5. BrowserViewFrame Status Bridging

**Current:** BrowserViewFrame notifies its parent (BrowserViewPanel) of status changes via `onStatusChange` and `onUrlChange` callbacks.

**After:** BrowserViewFrame additionally updates `BrowserSessionContext` so that AgentLayout can react to status changes (e.g., auto-expand the panel when streaming starts).

Two approaches:

**Approach A (Recommended): BrowserViewPanel bridges to BrowserSessionContext.**
BrowserViewPanel already receives `onStatusChange` from BrowserViewFrame. It writes to BrowserSessionContext:

```typescript
const { setStatus, setCurrentUrl } = useBrowserSession();

const handleStatusChange = useCallback((newStatus: StreamStatus) => {
  setStatus(newStatus);  // Updates context -> triggers panel expand
}, [setStatus]);
```

This keeps BrowserViewFrame unchanged and puts the bridging in BrowserViewPanel, which already had this responsibility.

**Approach B: BrowserViewFrame writes directly to context.**
BrowserViewFrame calls `useBrowserSession()` and writes status directly. This removes the prop-based callbacks but couples BrowserViewFrame to a context it didn't previously know about.

**Recommendation: Approach A.** It preserves the existing callback pattern and keeps BrowserViewFrame context-free.

### 6. Panel Auto-Expand/Collapse Integration

AgentLayout needs to programmatically expand/collapse the browser panel based on `BrowserSessionContext.isActive`.

```typescript
// Inside AgentLayout:
const { isActive } = useBrowserSession();
const browserPanelRef = usePanelRef();

useEffect(() => {
  if (!browserPanelRef.current) return;
  if (isActive) {
    browserPanelRef.current.expand();
  } else {
    browserPanelRef.current.collapse();
  }
}, [isActive, browserPanelRef]);
```

The `usePanelRef` hook is exported by react-resizable-panels (verified from the type definitions: `usePanelRef(): RefObject<PanelImperativeHandle | null>`).

### 7. Handling the Separator Visibility

When the browser panel is collapsed to 0, its adjacent `PanelSeparator` should not be visible or interactive. Two approaches:

**Approach A:** Conditionally render the separator based on `isActive`:
```tsx
{isActive && <PanelSeparator />}
```
This is simple but changes the number of children in the Group, which react-resizable-panels v4 handles via its conditional rendering support (requires `id` and `order` props).

**Approach B:** Always render the separator but hide it via CSS when collapsed:
```tsx
<PanelSeparator className={isActive ? '' : 'hidden'} />
```
This avoids Group child-count changes but a hidden separator still occupies layout concerns.

**Recommendation: Approach A (conditional separator).** react-resizable-panels v4 was designed for conditional children. Using `id` and `order` props on all panels makes this work cleanly.

---

## Data Flow Diagram

```
[ToolFallback]                    [BrowserViewFrame]
  |                                  |
  | registerToolCall()               | onStatusChange(status)
  v                                  | onUrlChange(url)
[BrowserToolCallsContext]            v
  |                            [BrowserViewPanel]
  |                                  |
  | toolCalls[]                      | setStatus(status)
  |                                  | setCurrentUrl(url)
  v                                  v
[BrowserToolCallHistory]       [BrowserSessionContext]
[useInputCoordination]               |
                                     | isActive
                                     v
                               [AgentLayout]
                                     |
                                     | expand() / collapse()
                                     v
                               [CollapsiblePanel id="browser-slot"]
```

---

## Build Order

Changes must be sequenced to maintain a working build at each step.

### Step 1: Create BrowserSessionContext (additive, no breaking changes)

**Files created:**
- `packages/playground-ui/src/domains/agents/context/browser-session-context.tsx`

**What:** Create the new context, provider, and consumer hook. Export from the context barrel file and domain index.

**Why first:** Everything else depends on this context existing. Creating it first has zero impact on existing code.

**Verification:** TypeScript compiles. No runtime behavior changes.

### Step 2: Hoist BrowserToolCallsProvider to Agent page level (refactor)

**Files modified:**
- `packages/playground-ui/src/lib/ai-ui/thread.tsx` -- remove conditional `BrowserToolCallsProvider` wrapping
- `packages/playground/src/pages/agents/agent/index.tsx` -- add `BrowserToolCallsProvider` wrapping around `AgentLayout`

**What:** Move the provider up without changing any consumer code. `ToolFallback` still finds the context (now a more distant ancestor). `BrowserToolCallHistory` still finds it (same subtree, since BrowserViewPanel is still inside Thread at this step).

**Why second:** This is a pure refactor that preserves behavior. It decouples the provider from Thread, which is required before Thread can lose the BrowserViewPanel.

**Risk:** If any consumer relies on provider proximity (e.g., per-Thread state isolation), this could cause subtle bugs. However, there is only one Thread instance per agent page, so provider-per-Thread === provider-per-page. No risk.

**Verification:** Browser tool calls still appear in BrowserToolCallHistory. ToolFallback still hides browser tools from chat. No console errors about missing context.

### Step 3: Add BrowserSessionProvider to Agent page (additive)

**Files modified:**
- `packages/playground/src/pages/agents/agent/index.tsx` -- add `BrowserSessionProvider` wrapping

**What:** Wrap AgentLayout with BrowserSessionProvider. No consumers yet, so no behavior change.

**Verification:** TypeScript compiles. No runtime behavior changes.

### Step 4: Wire BrowserViewPanel to BrowserSessionContext (adapt)

**Files modified:**
- `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-panel.tsx`

**What:** Replace internal visibility state management with reads/writes to BrowserSessionContext. BrowserViewPanel still renders in the same tree position (inside Thread). At this stage, the CSS positioning changes have NOT been made -- the panel still uses absolute positioning.

**Details:**
- Remove `isVisible` state, replace with `isActive` from context
- Remove `handleStatusChange` visibility logic, replace with `setStatus` to context
- Keep `isCollapsed` as local state (header-only toggle is a panel-internal concern)
- The auto-show-on-streaming logic moves into BrowserSessionProvider's `setStatus`

**Verification:** Browser panel auto-shows when streaming starts. Close button hides the panel. Behavior identical to before.

### Step 5: Add browserSlot to AgentLayout (extend)

**Files modified:**
- `packages/playground-ui/src/domains/agents/components/agent-layout.tsx`

**What:** Accept `browserSlot` prop. Render a `CollapsiblePanel` between main-slot and right-slot. Wire `useBrowserSession().isActive` to `panelRef.collapse()/expand()`. Add `order` props to all panels.

**Details:**
- Browser panel: `collapsedSize={0}`, `collapsible={true}`, `defaultSize="40%"`, `minSize={200}`, `maxSize={'60%'}`
- Conditional separator before browser panel (only when `isActive`)
- All panels get `order` props for react-resizable-panels v4 conditional rendering

**Verification:** Browser panel appears as a resizable side panel. Can be resized. Collapses to 0 when inactive.

### Step 6: Extract BrowserViewPanel from Thread to browserSlot (move)

**Files modified:**
- `packages/playground-ui/src/lib/ai-ui/thread.tsx` -- remove `{agentId && <BrowserViewPanel agentId={agentId} />}`
- `packages/playground/src/pages/agents/agent/index.tsx` -- pass `browserSlot={<BrowserViewPanel agentId={agentId!} />}` to AgentLayout
- `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-panel.tsx` -- remove absolute positioning CSS, use flex layout for panel content

**What:** The actual move. BrowserViewPanel renders as panel content instead of an overlay.

**Verification:**
- Browser view appears as a side panel, not an overlay
- WebSocket connection survives panel collapse/expand (check network tab)
- Tool call history works in the new position
- Input coordination (agent busy overlay) still functions
- Auto-show on streaming works
- Close button hides the panel
- Panel is resizable via drag handle

### Step 7: Clean up Thread component

**Files modified:**
- `packages/playground-ui/src/lib/ai-ui/thread.tsx` -- remove `BrowserViewPanel` import, remove `BrowserToolCallsProvider` import (already removed from rendering in Step 2)
- `packages/playground-ui/src/lib/ai-ui/thread.tsx` -- simplify `ThreadProps` (agentId still needed for Composer speech input)

**Verification:** Thread component is cleaner. No browser-specific imports remain (except agentId for Composer).

---

## WebSocket Never-Unmount Guarantee

### How the guarantee is preserved at each step

| Step | BrowserViewFrame location | Mounts/Unmounts? | WebSocket safe? |
|------|---------------------------|-------------------|-----------------|
| Current | Inside Thread, CSS off-screen when hidden | Never unmounts | Yes |
| After Step 4 | Inside Thread, CSS off-screen when hidden | Never unmounts | Yes |
| After Step 6 | Inside CollapsiblePanel in AgentLayout | Never unmounts (panel collapses to 0, children stay mounted) | Yes |

**Why react-resizable-panels collapse preserves children:**
A `Panel` with `collapsible={true}` and `collapsedSize={0}` does NOT unmount its children when collapsed. Verified from the library source (`react-resizable-panels.js`): the Panel component renders a `<div>` with `flexGrow: var(CSS_VARIABLE, 1)` and `flexShrink: 1` and `overflow: hidden`. When collapsed, the CSS variable is set to 0, making the panel visually disappear. The React tree (and all children) stays mounted -- only the CSS layout changes.

**Additional safeguard:** The BrowserViewPanel wrapper can add `overflow: hidden` to prevent layout thrash when the panel collapses.

### Testing the guarantee

After implementation, verify:
1. Open browser tab DevTools Network tab, filter for WebSocket
2. Trigger browser session (see WebSocket connect)
3. Close browser panel (collapse)
4. Verify WebSocket stays open (no close frame in Network)
5. Re-open browser panel (expand)
6. Verify screencast resumes immediately (no reconnect delay)

---

## React-Resizable-Panels v4 Integration Notes

**Version in use:** 4.0.15 (from `packages/playground-ui/package.json`)

**v4 API naming** (already used in codebase):
- `Group` (not `PanelGroup`)
- `Panel`
- `Separator` (not `PanelResizeHandle`)
- `useDefaultLayout` for persistence
- `usePanelRef` for imperative handle

**Conditional panel requirements (v4):**
- Every conditional Panel MUST have a stable `id` prop (already the case for existing panels)
- `order` prop is recommended to maintain correct DOM ordering when panels appear/disappear
- `useDefaultLayout` automatically persists separate layouts per combination of visible panels
- The `onLayoutChange` callback fires when panel count changes

**Current `useDefaultLayout` key:** `agent-layout-${agentId}` -- this already includes the agentId, so per-agent layouts are isolated. The library will auto-create separate stored entries for 3-panel vs 4-panel configurations.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Conditional rendering of BrowserViewFrame

**What:** Using `{isActive && <BrowserViewFrame />}` to show/hide the frame.

**Why bad:** Unmounts the component, killing the WebSocket. On re-mount, requires full reconnection (1-2 seconds of loading skeleton, potential frame loss).

**Instead:** Always render BrowserViewFrame inside a collapsible panel. The panel collapses to zero visual space but children stay mounted.

### Anti-Pattern 2: Passing visibility state via props through AgentChat/Thread

**What:** Threading `isBrowserActive` through AgentChat -> Thread -> BrowserViewPanel via props.

**Why bad:** Couples unrelated components. AgentChat and Thread should not know about browser panel visibility. This is layout-level concern, not chat-level concern.

**Instead:** Use BrowserSessionContext for cross-cutting session state. Components read from context, not prop chains.

### Anti-Pattern 3: Moving BrowserToolCallsProvider above MastraRuntimeProvider

**What:** Placing BrowserToolCallsProvider at the very top of the provider stack (above all other providers).

**Why bad:** Unnecessarily wide scope. BrowserToolCallsProvider state (tool call entries) is per-conversation/thread, and MastraRuntimeProvider is per-thread. Placing BrowserToolCallsProvider outside all runtime concerns means thread changes could leave stale tool call data.

**Instead:** Place BrowserToolCallsProvider inside ThreadInputProvider but above AgentLayout. This is wide enough for both Thread (ToolFallback) and browser panel (BrowserToolCallHistory) to access it, but narrow enough that it refreshes with thread context changes.

### Anti-Pattern 4: Using panelRef.resize(0) instead of collapse()

**What:** Programmatically setting the browser panel size to 0 via `resize(0)`.

**Why bad:** `resize(0)` and `collapse()` have different semantics. `resize(0)` sets the panel to minimum size, which may not be 0 if `minSize` is set. `collapse()` explicitly transitions to `collapsedSize`, which respects the collapsible panel's state machine (collapsed vs expanded).

**Instead:** Use `collapse()` and `expand()` from `PanelImperativeHandle`.

---

## Open Questions

### 1. Thread key-based remounting

**What we know:** The Agent page renders `<AgentChat key={threadId} ... />`. When `threadId` changes, React unmounts and remounts the entire AgentChat subtree, including Thread and everything inside it.

**What's unclear:** Since BrowserViewPanel is moving OUT of the Thread/AgentChat subtree and into AgentLayout, it will no longer be affected by the `key={threadId}` remount. Is this desirable?

**Likely answer:** Yes, this is desirable. The browser session is agent-scoped (the WebSocket URL is `/browser/${agentId}/stream`), not thread-scoped. When the user switches threads, the browser session should persist. If the user explicitly closes the browser, they use the close button which calls the close API.

**Risk:** LOW. The current behavior already preserves the WebSocket through message re-renders; this is the same principle extended to thread switches.

**However:** BrowserToolCallsProvider is now also above AgentChat. Tool call history from a previous thread would persist into the next thread. This may need a reset mechanism (e.g., clear tool calls on thread change). This is a minor UX detail, not a blocker.

### 2. Multiple agent pages open simultaneously

**What we know:** The BrowserSessionProvider is per agent page instance. If the user opens two agent tabs, each gets its own provider and its own WebSocket.

**What's unclear:** The `useDefaultLayout` persistence key is `agent-layout-${agentId}`. Two tabs with the same agent would share stored layout. If one has the browser panel open and the other doesn't, the stored layout could conflict on reload.

**Recommendation:** Accept this as a known edge case. It affects only the initial layout on page load, not runtime behavior. The panel auto-expands based on streaming status regardless of stored layout.

### 3. Cloud Studio (Next.js) compatibility

**What we know:** `playground-ui` targets both local studio (React Router) and cloud studio (Next.js). The Agent page composition happens in the consuming app (`packages/playground`), not in `playground-ui`.

**What's unclear:** Whether cloud studio has its own page assembly that also needs the provider changes.

**Recommendation:** This research focuses on `packages/playground-ui` (component library) and `packages/playground` (local studio). Cloud studio integration is a follow-up concern. All new contexts and components are exported from `playground-ui`, so cloud studio can compose them identically.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all files listed in "Critical File Locations" table
- `react-resizable-panels` v4.0.15 TypeScript type definitions at `node_modules/.pnpm/react-resizable-panels@4.0.15_.../dist/react-resizable-panels.d.ts`
- `react-resizable-panels` v4.0.15 compiled source at `node_modules/.pnpm/react-resizable-panels@4.0.15_.../dist/react-resizable-panels.js` (verified flex-grow collapse mechanism)

### Secondary (MEDIUM confidence)
- [react-resizable-panels GitHub repository](https://github.com/bvaughn/react-resizable-panels) -- README and API documentation
- [react-resizable-panels conditional rendering example](https://react-resizable-panels.vercel.app/examples/conditional) -- v4 conditional panel patterns
- [react-resizable-panels v4 PR #528](https://github.com/bvaughn/react-resizable-panels/pull/528) -- v4 changelog and breaking changes
- [react-resizable-panels collapsible example](https://react-resizable-panels.vercel.app/examples/collapsible) -- imperative collapse/expand API

### Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Current architecture | HIGH | Direct codebase reading of all key files |
| Context hoisting strategy | HIGH | Follows established React patterns, verified provider positions and consumer dependencies |
| react-resizable-panels API | HIGH | Read from installed v4.0.15 type definitions and compiled source |
| Collapsible panel preserves children | HIGH | Verified from library source: uses flexGrow CSS variable, not conditional rendering |
| Conditional separator handling | MEDIUM | v4 supports conditional children per WebSearch, but exact behavior with separators should be verified during implementation |
| Build order dependencies | HIGH | Traced through actual imports and component tree |
