# Phase 15: Input Coordination - Research

**Researched:** 2026-01-29
**Domain:** React state coordination, agent-user input race prevention, visual busy indicators
**Confidence:** HIGH

## Summary

Phase 15 adds coordination between user mouse/keyboard input (Phases 12-14) and agent browser tool calls (the AI agent invoking `browser_click`, `browser_navigate`, etc.). The goal is to prevent destructive race conditions -- for example, the user clicking an element while the agent is simultaneously clicking a different element, causing stale refs, double navigation, or element invalidation.

The critical discovery is that the existing `BrowserToolCallsContext` already provides all the data needed to derive agent-busy state. The context tracks `BrowserToolCallEntry` objects with a `status` field of `'pending' | 'complete' | 'error'`. When any entry has `status === 'pending'`, the agent is actively executing a browser tool call. This means no new WebSocket signaling, no server-side changes, and no new transport mechanism is needed. The coordination layer is entirely client-side, derived from data that already flows through the React tree.

The recommended approach is: (1) derive `isAgentBusy` from the existing tool call context (any pending browser tool call), (2) add a visual overlay/indicator on the browser frame when the agent is busy, (3) suppress user mouse clicks (but not mouse moves or keyboard input for the current typing session) when the agent is busy, and (4) document remaining edge cases as known limitations. This is the simplest approach that avoids the worst races while keeping implementation complexity low.

**Primary recommendation:** Derive agent-busy state from `BrowserToolCallsContext` (any tool call with `status === 'pending'`), add a visual busy indicator to the browser frame, and suppress click/scroll input during agent activity. No server-side changes needed.

## Standard Stack

No new dependencies are needed. This phase uses existing infrastructure only.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | >=19.0.0 (existing) | State derivation, context consumption, useReducer for FSM | Already in use |
| BrowserToolCallsContext | (project) | Source of truth for pending/complete tool calls | Already tracks agent browser tool activity |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | (project version) | Busy indicator styling, opacity overlays | Visual feedback |
| lucide-react | (project version) | Loader2 spinner icon (already used in BrowserToolCallItem) | Busy spinner |
| cn utility | (project) | Conditional class composition | Existing pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deriving from BrowserToolCallsContext | WebSocket "agent_busy" events from server | Requires server-side changes, new message type, more plumbing. Context approach is zero-cost since data already flows. |
| Deriving from BrowserToolCallsContext | Wrapping tool execute functions with pre/post signals | Invasive change to core tool execution. Context approach is read-only. |
| Simple boolean `isAgentBusy` | XState / useStateMachine formal FSM | Overkill for 3-state (IDLE/AGENT_ACTIVE/USER_ACTIVE) system. useReducer is sufficient. |
| Suppressing user input during agent activity | Queuing user input for replay after agent finishes | Queuing adds complexity (what if the page changed?), stale input risk. Suppression with visual feedback is simpler and safer. |

**Installation:**
```bash
# No installation needed -- all dependencies already present
```

## Architecture Patterns

### Recommended Project Structure
```
packages/playground-ui/src/domains/agents/
  hooks/
    use-input-coordination.ts     # NEW: derives coordination state from context
    use-mouse-interaction.ts      # MODIFY: accept disabled flag for agent-busy
    use-keyboard-interaction.ts   # UNCHANGED (keyboard continues during agent activity)
    use-browser-stream.ts         # UNCHANGED
    use-click-ripple.ts           # MODIFY: suppress during agent activity
  context/
    browser-tool-calls-context.tsx # UNCHANGED (already provides pending status)
  components/browser-view/
    browser-view-frame.tsx        # MODIFY: consume coordination state, render busy overlay
    agent-busy-overlay.tsx        # NEW: visual indicator when agent is executing
```

### Pattern 1: Derived Agent-Busy State from Existing Context
**What:** Read the `toolCalls` array from `BrowserToolCallsContext` and compute `isAgentBusy = toolCalls.some(tc => tc.status === 'pending')`. This is a pure derivation with no new data sources.
**When to use:** Always -- this is the primary coordination signal.
**Why this works:** The `ToolFallback` component in `tool-fallback.tsx` calls `registerToolCall` with `status: result !== undefined ? 'complete' : 'pending'` on every render. When the AI SDK streams a tool call, it first renders with `result === undefined` (pending), then re-renders with the result (complete). This lifecycle exactly matches "agent is executing a browser tool."
**Example:**
```typescript
// Source: derived from existing browser-tool-calls-context.tsx
import { useBrowserToolCalls } from '../context/browser-tool-calls-context';

/**
 * Derives input coordination state from existing tool call tracking.
 *
 * Returns isAgentBusy (any pending browser tool call) and the
 * currently active tool name for display purposes.
 */
export function useInputCoordination() {
  const { toolCalls } = useBrowserToolCalls();

  const pendingCalls = toolCalls.filter(tc => tc.status === 'pending');
  const isAgentBusy = pendingCalls.length > 0;
  const activeToolName = isAgentBusy ? pendingCalls[0].toolName : null;

  return { isAgentBusy, activeToolName, pendingCount: pendingCalls.length };
}
```

### Pattern 2: Input State as Three-Phase Enum
**What:** Track the input coordination state as `'IDLE' | 'AGENT_ACTIVE' | 'USER_ACTIVE'` to distinguish between periods where no one is acting, the agent is executing a tool, and the user is actively interacting.
**When to use:** When the coordination logic needs to make different decisions based on who is currently active.
**Example:**
```typescript
// Source: standard React state machine pattern via useReducer
type InputState = 'IDLE' | 'AGENT_ACTIVE' | 'USER_ACTIVE';

type InputAction =
  | { type: 'AGENT_TOOL_STARTED' }
  | { type: 'AGENT_TOOL_FINISHED' }
  | { type: 'USER_INPUT_STARTED' }
  | { type: 'USER_INPUT_ENDED' };

function inputReducer(state: InputState, action: InputAction): InputState {
  switch (action.type) {
    case 'AGENT_TOOL_STARTED':
      return 'AGENT_ACTIVE';
    case 'AGENT_TOOL_FINISHED':
      return 'IDLE';
    case 'USER_INPUT_STARTED':
      // Only transition if not agent-busy
      return state === 'AGENT_ACTIVE' ? state : 'USER_ACTIVE';
    case 'USER_INPUT_ENDED':
      return state === 'USER_ACTIVE' ? 'IDLE' : state;
    default:
      return state;
  }
}
```

### Pattern 3: Agent Busy Visual Overlay
**What:** When the agent is executing a browser tool call, overlay a semi-transparent layer on the browser frame with a spinner and the tool name. The overlay uses `pointer-events: auto` to absorb click events, preventing them from reaching the underlying `<img>` element.
**When to use:** Whenever `isAgentBusy === true`.
**Example:**
```typescript
// Source: follows existing overlay patterns in browser-view-frame.tsx
interface AgentBusyOverlayProps {
  toolName: string | null;
}

export function AgentBusyOverlay({ toolName }: AgentBusyOverlayProps) {
  const displayName = toolName
    ? toolName.replace('browser_', '')
    : 'working';

  return (
    <div className="absolute inset-0 bg-surface1/50 flex items-center justify-center z-10">
      <div className="flex items-center gap-2 bg-surface2 px-3 py-1.5 rounded-md border border-border1">
        <Loader2 className="h-3.5 w-3.5 text-accent1 animate-spin" />
        <span className="text-xs text-neutral4">
          Agent: {displayName}
        </span>
      </div>
    </div>
  );
}
```

### Pattern 4: Ring Color Change During Agent Activity
**What:** When interactive mode is active AND the agent is busy, change the ring color from `ring-accent1` (green, user active) to `ring-warning` or `ring-amber-400` (amber, agent active) to visually distinguish the two states.
**When to use:** When the user has entered interactive mode and the agent starts a tool call. The ring stays visible but changes color to signal "agent is acting."
**Example:**
```typescript
// In browser-view-frame.tsx container div:
<div
  ref={containerRef}
  className={cn(
    'relative w-full aspect-video bg-surface2 rounded-md overflow-hidden',
    isInteractive && !isAgentBusy && 'ring-2 ring-accent1',      // User active: green ring
    isInteractive && isAgentBusy && 'ring-2 ring-amber-400',      // Agent active: amber ring
  )}
>
```

### Anti-Patterns to Avoid
- **Adding WebSocket "agent_busy" messages from the server:** The data already exists client-side via `BrowserToolCallsContext`. Adding a separate signaling channel creates a synchronization problem between two independent state sources.
- **Blocking ALL input during agent activity:** Mouse move events are harmless (cursor tracking). Keyboard input may be mid-sentence. Only block destructive actions (clicks, scrolls) that could race with agent tool calls.
- **Queuing user clicks for replay:** The page state may have changed after the agent tool completes (e.g., navigation). Replaying stale clicks is worse than suppressing them.
- **Using setTimeout to estimate tool call duration:** Tool calls have unpredictable latency. Always derive busy state from actual pending/complete status transitions.
- **Creating a new context provider for coordination:** The `BrowserToolCallsContext` already provides the data. A new provider adds wrapper nesting and re-render surface. A hook that reads the existing context is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent busy detection | Custom WebSocket events or server polling | Derive from `BrowserToolCallsContext` pending status | Data already flows through React tree; zero additional infrastructure |
| Click suppression during busy state | Custom event interceptor layer | Conditional `pointer-events-none` CSS class or early return in event handler | CSS pointer-events is the standard browser mechanism for this |
| State machine library | XState, useStateMachine | `useReducer` with 3 states | Three states with simple transitions; library overhead not justified |
| Busy spinner animation | Custom CSS spinner | Existing `Loader2` from lucide-react + `animate-spin` | Already used in `BrowserToolCallItem` for pending status |
| Visual feedback for coordination state | New design system component | Compose existing atoms: `Loader2`, `cn()`, Tailwind opacity/ring utilities | Consistent with existing overlay patterns in `browser-view-frame.tsx` |

**Key insight:** The entire coordination feature is a client-side derived state problem. The signal (pending tool calls) already exists. The visual feedback uses existing components. The input gating is a CSS class change. No new infrastructure, transport, or dependencies are needed.

## Common Pitfalls

### Pitfall 1: Stale isAgentBusy After Tool Call Completes
**What goes wrong:** The busy overlay persists after the agent tool call finishes because the context update is delayed or missed.
**Why it happens:** `ToolFallback` re-renders when `result` changes from `undefined` to a value. If the re-render is batched or delayed, the `status: 'complete'` update to the context may lag.
**How to avoid:** React 18+ automatic batching should handle this correctly. The `registerToolCall` function in `BrowserToolCallsContext` does an immediate state update with functional updater. If issues arise, verify that `ToolFallback` re-renders promptly when `result` arrives.
**Warning signs:** Busy overlay stays visible for seconds after the tool call result appears in the tool call history.

### Pitfall 2: User Trapped in Agent-Busy State
**What goes wrong:** The agent tool call hangs (e.g., network timeout), and the user cannot interact with the browser at all because the busy overlay blocks everything.
**Why it happens:** The tool call remains `pending` indefinitely if the server never returns a result.
**How to avoid:** Two mitigations: (1) The existing tool timeout (10s default in `BrowserToolsetConfig`) will eventually cause the tool to fail, which triggers a result update. (2) As a safety valve, the busy overlay should have a manual dismiss option (e.g., clicking through it after a few seconds, or a small "dismiss" button) so the user can override if needed. Alternatively, document this as a known limitation for v1.2.
**Warning signs:** Overlay stays forever; user cannot interact even after waiting.

### Pitfall 3: Race Between User Click and Agent Tool Start
**What goes wrong:** User clicks at the exact moment the agent dispatches a tool call. Both the user click and the agent tool execute against the same page state, causing a double action or element invalidation.
**Why it happens:** The `isAgentBusy` derivation depends on React re-renders. Between the agent SDK sending the tool call and the `ToolFallback` component re-rendering, there is a brief window where `isAgentBusy` is still `false`.
**How to avoid:** Accept this as a known limitation. The window is very small (one React render cycle, typically <16ms). The worst case is a double-click or a click that targets a now-stale element, which CDP handles gracefully (clicking a removed element returns an error, navigation to an already-navigated URL is a no-op). Document this race window in the phase plan.
**Warning signs:** Occasional double-actions when user and agent act simultaneously.

### Pitfall 4: Mouse Move Events Blocked During Agent Activity
**What goes wrong:** User cannot see hover feedback or cursor changes because mouse move events are blocked along with clicks.
**Why it happens:** Overly aggressive input suppression that blocks all mouse events instead of just destructive ones (clicks, scrolls).
**How to avoid:** Only suppress `mousePressed`, `mouseReleased`, and `mouseWheel` events during agent activity. Continue forwarding `mouseMoved` events -- they are read-only and cannot cause race conditions. Alternatively, use a CSS overlay that blocks clicks but allows cursor movement over it.
**Warning signs:** Cursor freezes or disappears when agent is active.

### Pitfall 5: Keyboard Input Lost Mid-Sentence
**What goes wrong:** User is typing in a form field, agent triggers a tool call, and subsequent keystrokes are swallowed.
**Why it happens:** Blocking keyboard input when the agent becomes busy interrupts the user's active typing session.
**How to avoid:** Do NOT block keyboard input during agent activity. Keyboard input to a form field is generally safe -- even if the agent navigates away, the keystrokes are harmless (sent to a page that may have changed). The main risk is click+scroll races, not keyboard races. Let keyboard continue flowing.
**Warning signs:** Letters disappear while typing when the agent runs a tool call.

### Pitfall 6: Agent Busy Overlay Appears for Non-Browser Tool Calls
**What goes wrong:** The overlay appears when the agent calls any tool (e.g., a non-browser knowledge retrieval tool), not just browser tools.
**Why it happens:** Checking the wrong context or not filtering by tool type.
**How to avoid:** `BrowserToolCallsContext` already only tracks tools that pass the `isBrowserTool(toolName)` check (tool name starts with `browser_`). The derivation from this context is inherently scoped to browser tools. No additional filtering needed.
**Warning signs:** Overlay appears when agent is not doing browser work.

## Code Examples

### useInputCoordination Hook (Complete)
```typescript
// Source: derived from existing BrowserToolCallsContext pattern
import { useMemo } from 'react';
import { useBrowserToolCalls } from '../context/browser-tool-calls-context';

export type InputPhase = 'IDLE' | 'AGENT_ACTIVE' | 'USER_ACTIVE';

interface InputCoordinationState {
  /** Whether any browser tool call is currently pending */
  isAgentBusy: boolean;
  /** Name of the currently executing browser tool (e.g., 'browser_navigate') */
  activeToolName: string | null;
  /** Number of pending browser tool calls */
  pendingCount: number;
}

/**
 * Derives input coordination state from the existing BrowserToolCallsContext.
 *
 * This hook does NOT create new state -- it reads the tool call context
 * and computes isAgentBusy as a derived value. When any browser tool call
 * has status === 'pending', the agent is actively executing.
 *
 * The derivation works because ToolFallback registers tool calls with
 * status: 'pending' when result is undefined (AI SDK streaming the call)
 * and status: 'complete' when result arrives.
 */
export function useInputCoordination(): InputCoordinationState {
  const { toolCalls } = useBrowserToolCalls();

  return useMemo(() => {
    const pendingCalls = toolCalls.filter(tc => tc.status === 'pending');
    const isAgentBusy = pendingCalls.length > 0;
    const activeToolName = isAgentBusy ? pendingCalls[0].toolName : null;

    return { isAgentBusy, activeToolName, pendingCount: pendingCalls.length };
  }, [toolCalls]);
}
```

### AgentBusyOverlay Component
```typescript
// Source: follows existing overlay patterns in browser-view-frame.tsx
import { Loader2 } from 'lucide-react';

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  browser_navigate: 'Navigating',
  browser_click: 'Clicking',
  browser_type: 'Typing',
  browser_scroll: 'Scrolling',
  browser_screenshot: 'Capturing',
  browser_snapshot: 'Reading page',
  browser_close: 'Closing',
  browser_select: 'Selecting',
};

interface AgentBusyOverlayProps {
  toolName: string | null;
}

/**
 * Semi-transparent overlay shown when agent is executing a browser tool.
 *
 * The overlay absorbs click events (default pointer-events behavior for
 * positioned elements) preventing user clicks from reaching the img element.
 * Mouse moves still show cursor on top of the overlay.
 */
export function AgentBusyOverlay({ toolName }: AgentBusyOverlayProps) {
  const displayName = toolName
    ? (TOOL_DISPLAY_NAMES[toolName] ?? toolName.replace('browser_', ''))
    : 'Working';

  return (
    <div className="absolute inset-0 bg-surface1/40 flex items-center justify-center z-10 cursor-not-allowed">
      <div className="flex items-center gap-2 bg-surface2 px-3 py-1.5 rounded-md border border-border1 shadow-sm">
        <Loader2 className="h-3.5 w-3.5 text-accent1 animate-spin" />
        <span className="text-xs font-medium text-neutral4">
          Agent: {displayName}
        </span>
      </div>
    </div>
  );
}
```

### Integration in BrowserViewFrame
```typescript
// Source: modification to existing browser-view-frame.tsx
import { useInputCoordination } from '../../hooks/use-input-coordination';
import { AgentBusyOverlay } from './agent-busy-overlay';

// Inside BrowserViewFrame component:
const { isAgentBusy, activeToolName } = useInputCoordination();

// Pass to useMouseInteraction to suppress clicks during agent activity:
useMouseInteraction({
  imgRef,
  viewport,
  sendMessage,
  enabled: status === 'streaming' && !isAgentBusy,
});

// Ripple also suppressed during agent activity:
const { ripples, removeRipple } = useClickRipple({
  imgRef,
  viewport,
  enabled: status === 'streaming' && hasFrame && !isAgentBusy,
});

// Keyboard continues even during agent activity:
useKeyboardInteraction({
  sendMessage,
  enabled: isInteractive, // NOT gated by isAgentBusy
  onEscape: exitInteractive,
});

// In JSX:
<div
  ref={containerRef}
  className={cn(
    'relative w-full aspect-video bg-surface2 rounded-md overflow-hidden',
    isInteractive && !isAgentBusy && 'ring-2 ring-accent1',
    isInteractive && isAgentBusy && 'ring-2 ring-amber-400',
  )}
>
  <img ... />
  <ClickRippleOverlay ... />
  {isAgentBusy && <AgentBusyOverlay toolName={activeToolName} />}
  {/* ... existing overlays ... */}
</div>
```

### Mouse Interaction Modification
```typescript
// In use-mouse-interaction.ts, the `enabled` prop already gates all listeners.
// When isAgentBusy is true, passing enabled: false to useMouseInteraction
// cleanly removes all mouse event listeners via the useEffect cleanup.
// No changes to the hook internals are needed.

// In browser-view-frame.tsx:
useMouseInteraction({
  imgRef,
  viewport,
  sendMessage,
  enabled: status === 'streaming' && !isAgentBusy,
  //                                  ^^^^^^^^^^^^
  // This is the only change needed. The hook already handles
  // enabled toggling via its useEffect dependency array.
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mutex/lock on shared browser resource | UI-level coordination with visual feedback | Standard in collaborative editing tools | Simpler, better UX than hard locks |
| Server-side agent-busy WebSocket events | Client-side derivation from tool call status | Enabled by React context pattern | Zero server changes needed |
| Full input queue with replay | Input suppression with visual indicator | Standard in VNC/remote desktop | Avoids stale input replay problems |
| Custom state machine library (XState) | useReducer or derived state | 2024+ React best practice for simple FSMs | No added dependency for 3-state system |

**Deprecated/outdated:**
- Full input queuing for collaborative browser control: Creates stale input problems when page state changes between queue and replay
- Server-side locking/mutex for browser page: Overly complex for the UI coordination problem; appropriate for server resource management but not client input gating

## Open Questions

1. **Manual dismiss for stuck busy overlay**
   - What we know: If a tool call hangs, the busy overlay blocks user interaction indefinitely. The tool timeout (10s) provides a safety net, but the user experience during that 10s window is poor.
   - What's unclear: Whether adding a "dismiss" button on the overlay is worth the added complexity, or whether documenting the timeout as the escape hatch is sufficient for v1.2.
   - Recommendation: For v1.2, rely on the tool timeout. If the tool hangs beyond 10s, the error status update will clear the overlay. Document this as a known limitation. A "dismiss" button can be added in a follow-up. Confidence: MEDIUM.

2. **Multiple simultaneous pending tool calls**
   - What we know: The AI SDK can theoretically dispatch multiple tool calls in parallel (e.g., `browser_snapshot` + `browser_screenshot`). The context tracks each independently.
   - What's unclear: Whether multiple simultaneous browser tool calls actually happen in practice (the agent typically operates sequentially).
   - Recommendation: Treat any `pendingCount > 0` as agent-busy. The overlay shows the first pending tool name. If there are multiple, the overlay stays until all complete. This is correct behavior. Confidence: HIGH.

3. **User interactive mode exit during agent activity**
   - What we know: If the user is in interactive mode (typing) and the agent starts a tool call, the ring changes to amber. Should the user be forced out of interactive mode?
   - What's unclear: Whether maintaining interactive mode during agent activity is useful (user can resume typing immediately after) or confusing (the ring color changed but keyboard still works).
   - Recommendation: Keep the user in interactive mode. The ring color change provides visual feedback that the agent is acting. Keyboard continues working. When the agent finishes, the ring returns to green. This is less disruptive than forcing mode exit. Confidence: MEDIUM.

## Sources

### Primary (HIGH confidence)
- `/packages/playground-ui/src/domains/agents/context/browser-tool-calls-context.tsx` -- Source of truth for pending/complete tool call status. `BrowserToolCallEntry.status` is `'pending' | 'complete' | 'error'`. The `registerToolCall` function does immediate state updates.
- `/packages/playground-ui/src/lib/ai-ui/tools/tool-fallback.tsx` -- Where tool calls are registered: `status: result !== undefined ? 'complete' : 'pending'`. This confirms the pending-to-complete lifecycle maps exactly to agent tool execution.
- `/packages/playground-ui/src/domains/agents/hooks/use-mouse-interaction.ts` -- Mouse hook has `enabled` prop that cleanly gates all listeners. Passing `enabled: false` when agent is busy removes all listeners via useEffect cleanup.
- `/packages/playground-ui/src/domains/agents/hooks/use-keyboard-interaction.ts` -- Keyboard hook is independently gated by `isInteractive`. No modification needed for coordination.
- `/packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx` -- Component structure with existing overlay patterns (reconnecting, error, loading) that the busy overlay follows.
- `/packages/playground-ui/src/domains/agents/components/browser-view/browser-tool-call-item.tsx` -- Already uses `Loader2` for pending status display, establishing visual precedent.
- `/packages/playground-ui/src/domains/agents/hooks/use-click-ripple.ts` -- Has `enabled` prop for clean suppression during agent activity.

### Secondary (MEDIUM confidence)
- [React State Machine with useReducer (DEV Community)](https://dev.to/rohanfaiyazkhan/turning-your-react-component-into-a-finite-state-machine-with-usereducer-14nm) -- Pattern for implementing finite state machines with useReducer
- [React State Management 2025 (developerway)](https://www.developerway.com/posts/react-state-management-2025) -- Guidance that simple state derivation is preferred over state management libraries for straightforward use cases

### Tertiary (LOW confidence)
- Web search results on collaborative browser control and race conditions -- No specific library or pattern found; the domain is too new for established patterns. The approach is derived from first principles and existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; all tools already in the project
- Architecture: HIGH -- Derives from existing BrowserToolCallsContext, follows established hook/overlay patterns from Phases 12-14
- Agent-busy detection: HIGH -- Verified by reading ToolFallback registration logic: `status: result !== undefined ? 'complete' : 'pending'`
- Input suppression: HIGH -- The useMouseInteraction `enabled` prop already cleanly gates all listeners
- Visual indicator: HIGH -- Follows existing overlay patterns (reconnecting, error, loading) in browser-view-frame.tsx
- Race condition analysis: MEDIUM -- The render-cycle race window is real but small; edge cases documented as known limitations
- Pitfalls: HIGH -- All derived from actual code paths and React lifecycle analysis

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (stable; all infrastructure is existing project code)
