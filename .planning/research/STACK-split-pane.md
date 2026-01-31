# Technology Stack: Split-Pane Browser View Layout

**Project:** Mastra Playground - Browser View Layout Refactor
**Researched:** 2026-01-30
**Confidence:** HIGH (verified against installed library types and codebase)

## Executive Summary

The split-pane layout refactor requires **zero new dependencies**. The existing `react-resizable-panels@4.0.15` already installed in the project has all the APIs needed: conditional panel rendering with `id` props, collapsible panels via the imperative `collapse()`/`expand()` API, and pixel-unit sizing. The existing `AgentLayout` component already uses the `Group`/`Panel`/`CollapsiblePanel` pattern with a `rightSlot` prop -- the browser view panel just needs to be wired into that slot instead of being absolutely positioned inside the Thread component.

**Primary recommendation:** Use the existing `collapsible` + `collapsedSize={0}` pattern on a new browser panel, controlled imperatively via `usePanelRef`. No new libraries needed.

## Existing Stack (No Changes Needed)

### Already Installed and Used

| Library | Installed Version | Purpose | Verified |
|---------|-------------------|---------|----------|
| `react-resizable-panels` | `4.0.15` | Panel layout with resize, collapse, persist | Type definitions read from `node_modules` |
| React | `19.2.3` | UI framework | From `pnpm-lock.yaml` |
| Tailwind CSS | (project standard) | Styling | Used throughout codebase |

### Key APIs Already in Use

Verified from the installed `react-resizable-panels@4.0.15` type definitions at `/Users/abhiramaiyer/.superset/worktrees/mastra/ab-tools/node_modules/.pnpm/react-resizable-panels@4.0.15_react-dom@19.2.3_react@19.2.3__react@19.2.3/node_modules/react-resizable-panels/dist/react-resizable-panels.d.ts`:

| Export | Used In Codebase | Relevant for Refactor |
|--------|------------------|----------------------|
| `Group` | `AgentLayout`, `WorkflowLayout` | Container for panel group |
| `Panel` | `AgentLayout` (main-slot) | Main content panel |
| `Separator` | Wrapped in `PanelSeparator` | Resize handles between panels |
| `useDefaultLayout` | `AgentLayout` | Layout persistence to localStorage |
| `usePanelRef` | `CollapsiblePanel` | Imperative collapse/expand |

## What react-resizable-panels@4.0.15 Supports (Verified)

### Conditional Panel Rendering -- YES

The codebase already uses conditional rendering of panels. Verified in `agent-layout.tsx` (lines 27-41, 46-60):

```typescript
// This pattern ALREADY WORKS in the codebase:
{leftSlot && (
  <>
    <CollapsiblePanel id="left-slot" ...>{leftSlot}</CollapsiblePanel>
    <PanelSeparator />
  </>
)}
<Panel id="main-slot">{children}</Panel>
{rightSlot && (
  <>
    <PanelSeparator />
    <CollapsiblePanel id="right-slot" ...>{rightSlot}</CollapsiblePanel>
  </>
)}
```

The `id` prop on each `Panel` is the key mechanism for layout persistence -- `useDefaultLayout` stores a map of `{ [panelId]: number }`. When panels conditionally appear/disappear, the Group recalculates layout based on which `id`s are present.

### Collapsible Panels to Zero -- YES

From the v4.0.15 type definitions:
- `collapsedSize?: number | string | undefined` -- defaults to `0%`
- `collapsible?: boolean | undefined` -- enables collapse behavior
- Imperative API via `panelRef`: `collapse()`, `expand()`, `isCollapsed()`, `resize()`

This means a panel can be programmatically collapsed to zero size (effectively hidden) without unmounting.

### Pixel-Unit Sizing -- YES

v4 supports pixel, percentage, rem, em, vh, vw units. The existing `CollapsiblePanel` already uses pixel values for `minSize` and `collapsedSize`:

```typescript
<CollapsiblePanel
  minSize={300}        // 300px
  maxSize={'50%'}      // 50% of group
  defaultSize={300}    // 300px
  collapsedSize={60}   // 60px collapsed
/>
```

### Layout Persistence -- YES

The `useDefaultLayout` hook persists layouts to `localStorage` keyed by a unique `id`. The codebase uses `agent-layout-${agentId}` as the key. This means:
- Each agent gets its own remembered layout
- When the browser panel appears/disappears, the layout adjusts
- The Group stores the layout as a map of panel IDs to percentages

## The Two Approaches: Analysis

### Approach A: Conditional Rendering (Mount/Unmount Panel)

**How it works:** The browser panel + separator are conditionally rendered based on whether a browser session is active. When no session exists, they are not in the DOM.

```typescript
<Group ...>
  <Panel id="main-slot">{children}</Panel>
  {browserActive && (
    <>
      <PanelSeparator />
      <Panel id="browser-slot" ...>
        <BrowserViewPanel />
      </Panel>
    </>
  )}
</Group>
```

**Pros:**
- Clean DOM -- no hidden elements when browser is inactive
- Simple state model -- panel exists or doesn't
- Matches existing pattern for `leftSlot`/`rightSlot`

**Cons:**
- CRITICAL PROBLEM: Unmounting the panel unmounts `BrowserViewFrame`, which destroys the WebSocket connection. The current architecture explicitly avoids this (see `browser-view-panel.tsx` line 18-21 comment)
- Remounting means reconnect latency every time panel is toggled

**Verdict: NOT VIABLE** due to WebSocket preservation requirement.

### Approach B: Collapsible Panel with Zero CollapsedSize (RECOMMENDED)

**How it works:** The browser panel is always mounted but uses the collapsible API to collapse to zero when inactive. The imperative `collapse()`/`expand()` API controls visibility programmatically.

```typescript
<Group ...>
  <Panel id="main-slot">{children}</Panel>
  <PanelSeparator />
  <Panel
    id="browser-slot"
    panelRef={browserPanelRef}
    collapsible={true}
    collapsedSize={0}
    minSize={300}
    defaultSize={'40%'}
  >
    <BrowserViewPanel />
  </Panel>
</Group>
```

**Pros:**
- `BrowserViewFrame` NEVER unmounts -- WebSocket stays alive
- Imperative `collapse()`/`expand()` is clean API for show/hide
- Matches existing `CollapsiblePanel` wrapper pattern
- `collapsedSize={0}` means panel takes zero space when hidden
- Separator can also be hidden when panel is collapsed (via CSS or conditional render)

**Cons:**
- Panel DOM node exists even when collapsed (minimal cost)
- Separator visibility needs management (hide when panel collapsed)

**Verdict: USE THIS APPROACH.** It solves the WebSocket preservation constraint while providing clean show/hide behavior.

### Important Detail: Separator Visibility

When the browser panel is collapsed to zero, the separator should also be hidden. Two options:

1. **CSS approach:** Hide the separator when adjacent panel is collapsed using `data-panel` attributes or a CSS class
2. **Conditional render:** Only show separator when panel is not collapsed -- but this conflicts with always-mounted requirement

Recommended: Use the `onResize` callback on the browser panel to track collapsed state, then conditionally apply `className="hidden"` or `display: none` to the separator. The existing `CollapsiblePanel` already tracks collapsed state via `onResize`.

## What NOT to Add

### No New Layout Libraries

| Library | Why NOT |
|---------|---------|
| `allotment` | Redundant -- `react-resizable-panels` already does everything needed |
| `react-split-pane` | Unmaintained, less flexible than what we have |
| `react-mosaic` | Overkill for a 2-panel split |
| Custom CSS Grid solution | Would lose resize handles, persistence, imperative API |

### No Animation Libraries

| Library | Why NOT |
|---------|---------|
| `framer-motion` | Heavyweight for a simple show/hide; CSS transitions suffice |
| `react-spring` | Same -- overkill for this use case |
| `@react-spring/web` | Same |

The `react-resizable-panels` library does NOT have built-in smooth transition support for collapse/expand (confirmed via [GitHub Issue #310](https://github.com/bvaughn/react-resizable-panels/issues/310) and [Discussion #376](https://github.com/bvaughn/react-resizable-panels/discussions/376)). However, smooth animation is not a requirement for this refactor -- the goal is correct layout behavior, not visual polish. A panel collapsing/expanding instantly is acceptable and consistent with how the left sidebar and right info panel already behave.

### No State Management Libraries

| Library | Why NOT |
|---------|---------|
| `zustand` | Browser session state can be lifted to context or props |
| `jotai` | Same -- existing React context pattern (`BrowserToolCallsProvider`) is sufficient |

The browser visibility state flows from `BrowserViewFrame`'s `onStatusChange` callback. This can be lifted to the `AgentLayout` level via a context or callback prop without new state management.

## Integration Points with Existing Architecture

### Current Flow (What Changes)

```
BEFORE:
  AgentLayout (Group)
    leftSlot (CollapsiblePanel)
    main-slot (Panel)
      Thread
        BrowserViewPanel (absolute positioned overlay)
    right-slot (CollapsiblePanel: AgentInformation)

AFTER:
  AgentLayout (Group)
    leftSlot (CollapsiblePanel)
    main-slot (Panel)
      Thread (no more BrowserViewPanel)
    browser-slot (CollapsiblePanel: BrowserViewPanel)  <-- NEW
    right-slot (CollapsiblePanel: AgentInformation)
```

### Key Integration Decisions

**1. Panel ordering: browser-slot between main and right-slot**

The browser panel should appear between the chat (main) and the info panel (right). This puts the browser view in the most natural position -- immediately adjacent to the chat where the user is interacting. The `id` prop handles layout persistence.

**2. BrowserToolCallsProvider scope**

Currently wraps `Thread` content inside `thread.tsx`. Must be lifted to wrap the entire `AgentLayout` since `BrowserToolCallHistory` (inside `BrowserViewPanel`) and the chat (inside `Thread`) both need access.

**3. Browser session state lifting**

`BrowserViewPanel` currently manages its own visibility state. For the split-pane layout, the collapsed/expanded state of the panel needs to be driven by browser session status. This means:
- `BrowserViewFrame` still reports status via `onStatusChange`
- A new context or callback propagates "browser is active" up to `AgentLayout`
- `AgentLayout` uses `panelRef.current.expand()` / `panelRef.current.collapse()` imperatively

**4. The off-screen trick is no longer needed**

Currently `BrowserViewPanel` uses `fixed -left-[9999px] -top-[9999px]` to hide without unmounting. In the split-pane approach, the panel collapses to zero size via `react-resizable-panels` -- the component stays mounted but takes zero space. The off-screen positioning hack can be removed.

**5. Right-slot may need to accommodate or coexist**

Currently `rightSlot` is always `AgentInformation`. With the browser panel as a new panel, the layout becomes 4 panels (left sidebar, main chat, browser, right info). Consider whether the browser panel should REPLACE the right info panel or coexist alongside it. Recommendation: coexist, since `AgentInformation` provides settings/metadata that is useful alongside browser viewing. But the right-slot could be collapsible to give more room when browser is active.

## Version Consideration

The installed version is `4.0.15`. The latest available is reportedly `4.4.1` or `4.5.6` (sources disagree -- LOW confidence on exact latest). The `^4.0.15` semver range in `package.json` means `pnpm install` could pull a newer minor version.

**Recommendation:** Stay on the current installed version. The API surface needed (`collapsible`, `collapsedSize`, `usePanelRef`, `collapse()`, `expand()`) is all present in `4.0.15`. No upgrade needed.

If an upgrade is desired later, the v4 API is stable within the major version -- no breaking changes expected between `4.0.15` and `4.4.x`.

## Installation

```bash
# No new dependencies needed.
# Everything is already installed.
```

## Sources

### Primary (HIGH confidence)
- Installed `react-resizable-panels@4.0.15` type definitions -- read directly from `node_modules/.pnpm/react-resizable-panels@4.0.15_*/dist/react-resizable-panels.d.ts`
- Codebase files: `agent-layout.tsx`, `collapsible-panel.tsx`, `browser-view-panel.tsx`, `browser-view-frame.tsx`, `thread.tsx`, `separator.tsx`

### Secondary (MEDIUM confidence)
- [GitHub - bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) -- repository README and API description
- [react-resizable-panels v4 PR #528](https://github.com/bvaughn/react-resizable-panels/pull/528) -- v3 to v4 migration details
- [GitHub Issue #310](https://github.com/bvaughn/react-resizable-panels/issues/310) -- animation not built-in (confirmed no smooth transitions)
- [GitHub Discussion #376](https://github.com/bvaughn/react-resizable-panels/discussions/376) -- transitions workaround discussion

### Tertiary (LOW confidence)
- npm reports of latest version (sources give conflicting numbers: 4.4.1 vs 4.5.6; does not affect recommendations since we stay on installed version)

## Metadata

**Confidence breakdown:**
- Core approach (collapsible panel): HIGH -- verified against installed types and existing codebase patterns
- Integration points: HIGH -- read all relevant source files
- "No new deps" recommendation: HIGH -- confirmed all needed APIs exist in installed version
- Animation limitations: MEDIUM -- confirmed via GitHub issues but not tested locally
- Latest version number: LOW -- conflicting sources; irrelevant since we stay on installed version

**Research date:** 2026-01-30
**Valid until:** 2026-03-30 (stable library, no fast-moving concerns)
