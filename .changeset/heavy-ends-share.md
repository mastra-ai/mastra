---
'mastracode': patch
---

Fixed subagent output to auto-collapse to a single summary line when execution completes. Previously, the full bordered box with task description, tool call activity, and result stayed visible after completion. Now it collapses to a compact footer (e.g. `└── subagent explore 12.3s ✓`) and can be re-expanded with ctrl+e.
