---
'@mastra/playground-ui': minor
---

Added an "All traces, nested too" mode to the Observability → Traces page.

The traces list now has a switcher in the toolbar to toggle between two views:

- **Top-level traces only** (default) — one row per top-level run, the existing behavior.
- **All traces, nested too** — one row per invocation, including every agent, workflow, tool, processor, scorer, and RAG ingestion that ran nested inside another run.

This makes it possible to find every invocation of a given entity (e.g. "every run of `recipe-maker` workflow") regardless of how it was triggered. Selecting a row in the new mode opens a detail panel showing just that branch's subtree.

**New hooks** for consumers building their own observability UIs:

- `useBranch({ traceId, spanId, depth? })` — fetches the span subtree rooted at an anchor span.
- `useTraceOrBranchSpans({ traceId, spanId, listMode })` — returns trace spans or a branch subtree depending on the active mode.
