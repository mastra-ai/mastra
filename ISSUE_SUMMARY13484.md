# Issue #13484: Subagent output should auto-collapse on completion in the TUI

## Summary

When the main agent delegates to a subagent, the `SubagentExecutionComponent` renders its full activity (task description + rolling tool call window) directly in the chat flow. After completion, the box remains fully expanded, creating visual noise — especially when multiple subagents run in parallel.

## Root Cause Analysis

### The Problem

In `mastracode/src/tui/components/subagent-execution.ts`, the `finish()` method (line 79-85) sets `this.done = true` and calls `this.rebuild()`, but it does **not** set `this.expanded = false` to trigger a collapse. The `rebuild()` method always renders:

1. The top border
2. The task description (up to 5 lines when collapsed, full when expanded)
3. The tool call activity lines (up to 15 lines via `COLLAPSED_LINES = 15`)
4. The bottom border with status

So even after completion, 15+ lines of activity remain visible in the chat flow.

### Contrast with ToolExecutionComponentEnhanced

The `ToolExecutionComponentEnhanced` (line 119-123 of `tool-execution-enhanced.ts`) has proper collapse-on-default behavior:
```ts
this.options = {
  autoCollapse: true,
  collapsedByDefault: true,
  ...options,
};
this.expanded = !this.options.collapsedByDefault;
```

The subagent component has no equivalent — it starts with `expanded = false` (line 48), but this only controls:
- Task description truncation (5 lines max when collapsed)
- Activity line windowing (15 lines when collapsed)
- Final result visibility

It does NOT collapse to a single-line summary on completion.

### What Should Happen

When `finish()` is called (from `handleSubagentEnd` in `mastracode/src/tui/handlers/subagent.ts`, line 74), the component should:

1. If `this.done && !this.expanded`: render **only** the footer line as a collapsed single-line summary, e.g.:
   ```
   └── subagent explore claude-sonnet-4-20250514 12.3s ✓
   ```
2. If `this.done && this.expanded` (user pressed ctrl+e): render the full box as today.
3. The ctrl+e keybinding already works because `allToolComponents` (in `setup.ts` line 88-92) calls `setExpanded()` on all components including subagent components (they're pushed into `allToolComponents` in `handleSubagentStart`, line 19 of `handlers/subagent.ts`).

### Key Files

| File | Role |
|------|------|
| `mastracode/src/tui/components/subagent-execution.ts` | Component that renders the subagent box. `rebuild()` always renders full content. |
| `mastracode/src/tui/handlers/subagent.ts` | Event handlers. `handleSubagentEnd()` calls `finish()` but doesn't trigger collapse. |
| `mastracode/src/tui/setup.ts` (line 87-97) | ctrl+e handler toggles `toolOutputExpanded` on all tool components. |
| `mastracode/src/tui/state.ts` (line 105-111) | State tracking for `allToolComponents` and `pendingSubagents`. |

### Proposed Fix

In `SubagentExecutionComponent.rebuild()`, when `this.done && !this.expanded`, render only the single-line footer (the `└──` line with agent type, model, duration, and status icon). Skip the top border, task description, activity lines, and final result.

This way:
- On completion → auto-collapses to a single summary line
- ctrl+e → expands to show full activity log
- While running → still shows the rolling activity window as before

### How to Reproduce in a Test

The `SubagentExecutionComponent` can be instantiated directly with a mock TUI. We can:
1. Create a component
2. Add tool calls
3. Call `finish()`
4. Assert that `render()` output is a single line (just the footer)
5. Call `setExpanded(true)`
6. Assert that `render()` output includes full activity
