---
phase: 17-split-pane-layout
plan: 01
subsystem: playground-layout
tags: [react-resizable-panels, collapsible-panel, split-pane, browser-view]

dependency-graph:
  requires: [16-01]
  provides: [browser-slot-panel, thread-simplification, flex-layout-browser-panel]
  affects: [17-02, 18-01]

tech-stack:
  added: []
  patterns: [collapsedSize-0-for-mounted-hidden, browserSlot-prop-injection, flex-layout-panel]

key-files:
  created: []
  modified:
    - packages/playground-ui/src/domains/agents/components/agent-layout.tsx
    - packages/playground-ui/src/domains/agents/components/browser-view/browser-view-panel.tsx
    - packages/playground-ui/src/lib/ai-ui/thread.tsx
    - packages/playground/src/pages/agents/agent/index.tsx

decisions:
  - id: LAYOUT-SLOT
    choice: "browserSlot prop pattern with raw Panel (not CollapsiblePanel)"
    reason: "CollapsiblePanel conditionally renders children vs expand button when collapsed, which would unmount BrowserViewFrame and kill WebSocket. Raw Panel with collapsedSize=0 keeps children mounted at zero width."
  - id: LAYOUT-KEY-V2
    choice: "agent-layout-v2 storage key"
    reason: "Old 3-panel layout sizes stored under agent-layout-{agentId} would conflict with new 4-panel structure. Bumping key avoids stale layout restoration."
  - id: FLEX-POSITIONING
    choice: "Flex layout replacing absolute/fixed overlay"
    reason: "BrowserViewPanel lives in a layout panel now, not floating over chat. Flex container fills parent panel dimensions naturally."

metrics:
  duration: ~15min
  completed: 2026-01-31
---

# Phase 17 Plan 01: Split-Pane Layout Structure Summary

AgentLayout 4-panel structure with browserSlot, BrowserViewPanel extracted from Thread into collapsible layout panel using collapsedSize=0 for WebSocket preservation.

## What Was Done

### Task 1: Add browserSlot to AgentLayout with collapsible panel
**Commit:** `e40c060355`

Added `browserSlot?: React.ReactNode` prop to `AgentLayoutProps`. Renders a 4th panel between main-slot and right-slot:

- Uses raw `Panel` from react-resizable-panels (not `CollapsiblePanel`) to keep children always mounted
- Panel config: `id="browser-slot"`, `collapsible={true}`, `collapsedSize={0}`, `defaultSize={0}`, `minSize={300}`, `maxSize="50%"`
- `overflow-hidden` class hides content at zero width
- `usePanelRef()` creates `browserPanelRef` for future expand/collapse control (Plan 17-02)
- `PanelSeparator` added between main and browser slots (only when browserSlot provided)
- Layout storage key updated to `agent-layout-v2-${agentId}` to avoid collision with old 3-panel sizes

### Task 2: Extract BrowserViewPanel from Thread, adapt positioning, wire into Agent page
**Commit:** `1cccd21e70`

Three coordinated changes:

**Thread (thread.tsx):**
- Removed `BrowserViewPanel` import
- Removed `{agentId && <BrowserViewPanel agentId={agentId} />}` rendering
- Removed outer `<div className="relative h-full overflow-hidden">` wrapper
- ThreadPrimitive.Viewport is now direct child of ThreadWrapper's grid row

**BrowserViewPanel (browser-view-panel.tsx):**
- Replaced absolute/fixed positioning with `flex flex-col h-full w-full overflow-hidden`
- Removed conditional rendering of BrowserViewHeader, frame wrapper, and BrowserToolCallHistory
- Frame wrapper changed from conditional `hidden`/`p-2` to always-present `flex-1 min-h-0 p-2`
- Removed `cn()` utility import (no longer needed)
- Removed `className` prop (no longer needed for overlay styling)
- Updated JSDoc to reflect new layout panel context

**Agent page (index.tsx):**
- Added `BrowserViewPanel` to imports from `@mastra/playground-ui`
- Added `browserSlot={<BrowserViewPanel agentId={agentId!} />}` prop to `AgentLayout`

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Raw Panel vs CollapsiblePanel | Raw Panel with collapsedSize=0 | CollapsiblePanel swaps children for expand button when collapsed, unmounting BrowserViewFrame and killing WebSocket |
| Layout storage key | agent-layout-v2-${agentId} | Avoids stale 3-panel layout sizes being restored for 4-panel structure |
| Flex vs absolute positioning | Flex container filling parent panel | BrowserViewPanel is now a panel child, not a floating overlay |

## Build Verification

- `vite build` for playground-ui: SUCCESS (bundle produced)
- `vite build` for playground: SUCCESS (bundle produced)
- `tsc --noEmit` excluding pre-existing `provider-types.generated.d.ts` issue: ZERO errors in both packages
- Note: `pnpm build:cli` has a pre-existing failure in `core/dist/llm/model/provider-types.generated.d.ts` where an unquoted numeric identifier (`302ai`) breaks TS parsing. This is a code generator bug in core, not related to this plan's changes.

## Next Phase Readiness

Plan 17-02 requires:
- `browserPanelRef` -- created in AgentLayout, needs to be exposed via BrowserSessionContext for auto-expand
- `show()`/`hide()` from BrowserSessionContext -- need to trigger panel expand/collapse via the ref
- All structural pieces are in place. 17-02 wires the behavioral logic.
