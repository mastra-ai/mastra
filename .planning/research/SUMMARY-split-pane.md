# Project Research Summary: Split-Pane Browser View Layout

**Project:** Mastra Playground - Browser View Layout Refactor (v1.3)
**Domain:** React split-pane layout refactoring
**Researched:** 2026-01-30
**Confidence:** HIGH

## Executive Summary

The v1.3 milestone refactors the browser view from a floating overlay to a side-by-side split-pane layout. The research reveals this is a zero-dependency refactor: the existing `react-resizable-panels@4.0.15` provides all necessary APIs, and the current `AgentLayout` component already uses the right panel pattern. The critical constraint is preserving WebSocket stability — the `BrowserViewFrame` must never unmount, which eliminates conditional rendering approaches and requires using collapsible panels with `collapsedSize={0}` instead.

The recommended approach is a three-layer architectural change: (1) create a `BrowserSessionContext` to hoist browser visibility state to the layout level, (2) hoist `BrowserToolCallsProvider` from inside Thread to the Agent page level so both chat messages and the browser panel can access it, and (3) move `BrowserViewPanel` from absolute positioning inside Thread to a dedicated collapsible panel in `AgentLayout`. The collapsible panel stays mounted but collapses to zero pixels when inactive, preserving the WebSocket connection while making the panel visually disappear.

The main risks are WebSocket disconnection from accidental component remounting (CRITICAL), context scope mismatches after hoisting (CRITICAL), keyboard capture conflicts between interactive mode and panel resize controls (HIGH), and coordinate mapping glitches during active panel resize (MEDIUM). All have verified prevention strategies from codebase inspection and library documentation.

## Key Findings

### Recommended Stack

No new dependencies required. The existing `react-resizable-panels@4.0.15` already installed provides all needed functionality: conditional panel rendering with `id` props, collapsible panels via the imperative `collapse()`/`expand()` API, and pixel-unit sizing. The current `AgentLayout` already uses the `Group`/`Panel`/`CollapsiblePanel` pattern with a `rightSlot` prop — the browser view panel just needs to be wired into a new slot instead of being absolutely positioned.

**Core technologies:**
- `react-resizable-panels@4.0.15` (already installed) — Panel layout with resize, collapse, persist. Supports collapsible panels with zero collapsed size (children stay mounted).
- React 19.2.3 (already installed) — UI framework. Context-based state hoisting pattern.
- Tailwind CSS (already in use) — Styling. No layout library changes needed.

**Critical API decision:** Use `collapsible={true}` + `collapsedSize={0}` on a dedicated browser panel, controlled imperatively via `usePanelRef`. Do NOT use conditional rendering (`{condition && <Panel>}`) because that unmounts children and kills the WebSocket. The library maintainer explicitly states "the panel must be rendered even if it's collapsed" for the imperative API to work (GitHub Issue #285).

### Expected Features

**Must have (table stakes):**
- Side-by-side layout (chat left, browser right) — core requirement, every comparable tool uses this pattern
- Drag-to-resize handle — already exists via `PanelSeparator`, no new work needed
- Auto-show on browser session start — preserve current overlay behavior
- Close button dismisses panel — preserve current overlay behavior
- Collapse/expand toggle without closing session — already exists via `CollapsiblePanel`
- Hidden when no browser session exists — conditional slot population
- Layout size persistence — already exists via `useDefaultLayout`

**Should have (competitive):**
- Panel min/max size tuning for browser content — config change (400px min, 60% max, 40% default)
- Keyboard shortcut to toggle panel — low complexity, power user value
- URL copy button in header — low complexity utility
- Double-click separator to reset width — standard UX pattern
- Last frame snapshot on session end — already implemented, preserve it

**Defer (v2+):**
- Smooth panel appear/disappear animation — library doesn't support, workarounds are complex
- Responsive breakpoint stacking — high complexity, affects entire layout system

### Architecture Approach

The refactor requires extracting `BrowserViewPanel` from the Thread component tree and moving it to a new browser panel in `AgentLayout`, while preserving two critical invariants: (1) the `BrowserViewFrame` WebSocket connection must never break from remounting, and (2) both chat messages and the browser panel must access `BrowserToolCallsContext` for tool call history.

**Major components:**

1. **BrowserSessionContext (NEW)** — Hoisted session state providing `{isActive, status, currentUrl, show(), hide(), setStatus(), setCurrentUrl()}`. Shared between `BrowserViewFrame` (sets status) and `AgentLayout` (reads for auto-expand/collapse).

2. **AgentLayout (MODIFIED)** — Accepts new `browserSlot` prop, renders conditional 4th panel between main-slot and right-slot. Uses `useBrowserSession().isActive` to programmatically expand/collapse the browser panel via `panelRef.current.expand()/collapse()`.

3. **BrowserViewPanel (ADAPTED)** — No longer manages own visibility state. Reads `isActive` from context. Positioning changes from absolute to flex layout. Still contains `BrowserViewFrame` and `BrowserToolCallHistory`.

4. **BrowserToolCallsProvider (HOISTED)** — Moves from inside Thread to Agent page level, wrapping `AgentLayout`. This allows both `ToolFallback` (inside Thread messages) and `BrowserToolCallHistory` (inside browser panel) to access the same context.

5. **Thread (SIMPLIFIED)** — Removes `BrowserViewPanel` rendering and `BrowserToolCallsProvider` wrapping. Just renders messages and composer.

**Data flow:** `BrowserViewFrame` reports status via `onStatusChange` → `BrowserViewPanel` writes to `BrowserSessionContext.setStatus()` → auto-show logic triggers `isActive=true` when streaming → `AgentLayout` effect calls `browserPanelRef.expand()`.

### Critical Pitfalls

1. **WebSocket Disconnection from Component Remount** — Moving `BrowserViewFrame` to a different position in the React tree causes unmount/remount, killing the WebSocket (cleanup effect closes the socket). Prevention: Use collapsible panel with `collapsedSize={0}`, NOT conditional rendering. The panel collapses to zero visual space but children stay mounted.

2. **BrowserToolCallsContext Scope Mismatch** — If `BrowserToolCallsProvider` stays inside Thread (current location), then `BrowserToolCallHistory` (inside the new browser panel) exits the provider subtree and throws "must be used within a provider". Prevention: Hoist provider to Agent page level above `AgentLayout` so both Thread and browser panel are descendants.

3. **Keyboard Capture Conflicts with Panel Resize** — `useKeyboardInteraction` uses `document.addEventListener('keydown', {capture: true})` that swallows ALL keyboard events in interactive mode, breaking arrow-key panel resizing and tab navigation. Prevention: Scope the keyboard capture to the browser frame container element instead of `document`, or check `e.target` and let separator events through.

4. **Coordinate Mapping During Active Panel Resize** — `getBoundingClientRect()` is called per-event (correct), but during active drag the layout may be mid-animation. Clicks immediately after resize may map incorrectly if dimensions haven't settled. Prevention: Debounce interaction-enable after resize settles (~100ms), or disable interaction during active separator drag.

5. **React-Resizable-Panels Approach Mismatch** — Using conditional rendering (`{hasBrowserSession && <Panel>}`) instead of collapsible panels causes remounting (Pitfall 1) and conflicts with imperative API (library requires panel to be rendered for `collapse()/expand()` to work). Prevention: Architecture decision — always use collapsible panels for components that must persist state/connections.

## Implications for Roadmap

Based on research, suggested 3-phase structure optimized for incremental delivery and risk mitigation:

### Phase 1: Foundation (Context Infrastructure)
**Rationale:** Create new contexts and hoist providers WITHOUT changing any rendering. This establishes the state management layer before moving components, making the visual refactor (Phase 2) a pure UI change with no state migration risk.

**Delivers:**
- `BrowserSessionContext` with provider and consumer hook
- `BrowserToolCallsProvider` hoisted to Agent page level
- All tests pass, zero visual changes

**Avoids:** Context scope mismatch pitfall (establishes correct scope before anything depends on it)

**Research flag:** SKIP — standard React context pattern, well-documented. No special research needed.

### Phase 2: Layout Migration (Move to Split-Pane)
**Rationale:** With contexts in place, move `BrowserViewPanel` to `AgentLayout` as a collapsible panel. This is the core visual change, gated on Phase 1's context infrastructure.

**Delivers:**
- `browserSlot` prop added to `AgentLayout`
- `BrowserViewPanel` extracted from Thread, wired to browser slot
- Collapsible panel with `collapsedSize={0}`, imperative expand/collapse
- Panel auto-shows on streaming, hides on close
- Drag-to-resize handle via existing `PanelSeparator`

**Uses:** `react-resizable-panels` collapsible API, `usePanelRef` imperative handle

**Implements:** Phase 2 architecture components (AgentLayout modification, BrowserViewPanel adaptation)

**Avoids:**
- WebSocket disconnection pitfall (collapsible panel keeps component mounted)
- Storage key collision (change `useDefaultLayout` id to `agent-layout-v2-${agentId}`)

**Research flag:** SKIP — all patterns exist in codebase (`CollapsiblePanel` component, `useDefaultLayout` usage). Implementation is composition of known pieces.

### Phase 3: Interaction Hardening (Keyboard & Coordinate Edge Cases)
**Rationale:** The layout works after Phase 2, but keyboard capture and coordinate mapping edge cases degrade UX. This phase fixes interaction conflicts discovered in pitfall analysis.

**Delivers:**
- Scoped keyboard capture (container-level, not document-level)
- Click-outside detection excludes separator elements
- Interaction debounce after panel resize settles
- Panel size constraints (400px min, 60% max, 40% default)

**Avoids:**
- Keyboard capture conflict pitfall (scope to container)
- Click-outside on separator pitfall (exclude separator from detection)
- Coordinate mapping during resize pitfall (debounce interaction-enable)

**Research flag:** SKIP — targeted fixes with clear implementations from pitfall analysis.

### Phase 4: Polish (Optional Enhancements)
**Rationale:** Core functionality complete. This phase adds differentiators that elevate UX but aren't required for launch.

**Delivers:**
- Keyboard shortcut to toggle panel (Cmd+B)
- Double-click separator to reset width
- URL copy button in header
- Last frame preservation on session end (verify existing behavior still works)

**Avoids:** Feature creep (explicit anti-features documented: no animation, no floating panels, no multi-panel layouts, no position customization)

**Research flag:** SKIP — low-complexity enhancements, standard patterns.

### Phase Ordering Rationale

- **Foundation before migration** — Context hoisting (Phase 1) is invisible but critical. Doing it first means Phase 2 has no state management complexity, just component relocation.
- **Layout before interaction** — The split-pane must work visually (Phase 2) before fixing interaction edge cases (Phase 3). Users can test the layout even if keyboard shortcuts don't work yet.
- **Core before polish** — Phases 1-3 deliver the table stakes. Phase 4 is differentiators that can be deferred if time-constrained.
- **Preserves WebSocket at every step** — Phase 1 doesn't touch rendering, Phase 2 uses collapsible panels (not conditional), Phase 3 only modifies event handlers. No step remounts the frame.
- **Avoids pitfalls incrementally** — Each phase addresses specific pitfalls in its scope. No "big bang" refactor that could trigger multiple pitfalls simultaneously.

### Research Flags

**Phases needing deeper research during planning:**
- None — all patterns exist in codebase or are standard library usage. The research covered implementation details thoroughly.

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** React context pattern, provider hoisting
- **Phase 2:** react-resizable-panels collapsible API (already used in `CollapsiblePanel`)
- **Phase 3:** Event handler scoping, debounce patterns
- **Phase 4:** Keyboard shortcuts, UI enhancements

**Validation during implementation:**
- Verify WebSocket stays connected through panel collapse/expand (check Network tab)
- Verify tool call history works after provider hoisting (check `BrowserToolCallHistory` renders)
- Verify keyboard capture doesn't block separator resize (test arrow keys on focused separator)
- Verify coordinate mapping handles resize edge case (resize then immediately click)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against installed `react-resizable-panels@4.0.15` type definitions and source. All needed APIs confirmed present. |
| Features | HIGH | Feature list based on current overlay behavior (preserve table stakes) + competitive analysis (Operator, Claude, Cursor). No speculative features. |
| Architecture | HIGH | Direct codebase inspection of all affected files. Build order traced through actual import dependencies. Context hoisting pattern verified against React docs. |
| Pitfalls | HIGH | All critical pitfalls verified from codebase source (cleanup effects, context scoping, event handlers). Library limitations confirmed from GitHub issues. |

**Overall confidence:** HIGH

### Gaps to Address

**Thread key-based remounting interaction** — The Agent page renders `<AgentChat key={threadId}>`. When `threadId` changes, Thread remounts but browser panel (now outside AgentChat tree) does NOT remount. Browser session persists across thread switches. This is likely desirable (browser is agent-scoped, not thread-scoped), but `BrowserToolCallsProvider` also moves outside — tool call history from previous thread persists into next thread. May need a reset mechanism on thread change.
- **How to handle:** Verify during Phase 1 testing. If UX issue, add `useEffect` in provider that clears tool calls when `threadId` changes. LOW priority — does not block phases.

**Cloud Studio (Next.js) page assembly** — Research focused on `packages/playground`. Cloud studio may have its own Agent page assembly that also needs provider changes.
- **How to handle:** All new contexts exported from `playground-ui` — cloud studio can compose identically. Validate after Playground implementation. DEFER to follow-up.

**Panel size constraints for narrow viewports** — Research recommends 400px minimum for browser panel usability, but did not verify behavior below 1024px viewport.
- **How to handle:** Set `minSize={400}` in Phase 2. If viewport < 1024px, consider showing warning or fallback. Full responsive adaptation is anti-feature (deferred to future milestone).

## Sources

### Primary (HIGH confidence)
- Installed `react-resizable-panels@4.0.15` type definitions — `/node_modules/.pnpm/react-resizable-panels@4.0.15_*/dist/react-resizable-panels.d.ts`
- Installed `react-resizable-panels@4.0.15` compiled source — verified flex-grow collapse mechanism preserves React children
- Codebase files (direct inspection):
  - `packages/playground-ui/src/domains/agents/components/agent-layout.tsx`
  - `packages/playground-ui/src/lib/ai-ui/thread.tsx`
  - `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-panel.tsx`
  - `packages/playground-ui/src/domains/agents/components/browser-view/browser-view-frame.tsx`
  - `packages/playground-ui/src/domains/agents/context/browser-tool-calls-context.tsx`
  - `packages/playground-ui/src/domains/agents/hooks/use-browser-stream.ts`
  - `packages/playground-ui/src/domains/agents/hooks/use-mouse-interaction.ts`
  - `packages/playground-ui/src/domains/agents/hooks/use-keyboard-interaction.ts`
  - `packages/playground-ui/src/lib/resize/collapsible-panel.tsx`
  - `packages/playground/src/pages/agents/agent/index.tsx`

### Secondary (MEDIUM confidence)
- [react-resizable-panels GitHub repository](https://github.com/bvaughn/react-resizable-panels) — API documentation, conditional rendering support
- [react-resizable-panels GitHub Issue #285](https://github.com/bvaughn/react-resizable-panels/issues/285) — maintainer confirms imperative API requires rendered panels
- [react-resizable-panels GitHub Issue #310](https://github.com/bvaughn/react-resizable-panels/issues/310) — no native animation support (confirmed limitation)
- [react-resizable-panels conditional example](https://react-resizable-panels.vercel.app/examples/conditional) — v4 conditional panel patterns with `id` and `order` props
- [Emerge Haus Blog: The New Dominant UI Design for AI Agents](https://www.emerge.haus/blog/the-new-dominant-ui-design-for-ai-agents) — convergence on chat-left, action-right split-pane pattern
- [OpenAI Operator announcement](https://openai.com/index/introducing-operator/) — chat + browser side-by-side reference

### Tertiary (LOW confidence)
- Latest version number (4.4.1 vs 4.5.6) — conflicting sources, but irrelevant since we stay on installed 4.0.15
- Browser blur events during drag operations — browser-dependent behavior, needs testing
- PanelSeparator attribute changes in v4 — needs verification against rendered DOM

---
*Research completed: 2026-01-30*
*Ready for roadmap: yes*
