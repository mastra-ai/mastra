---
'@mastra/core': patch
---

Fixed `runEvals` throwing `TypeError: output is not iterable` when a workflow target is given a trajectory-only scorer config (`scorers: { trajectory: [...] }`). Workflow targets now always use the workflow scoring path. Added a warning when the target passed to `runEvals` is not registered with a Mastra instance, since registry lookups, score persistence, and trace-based trajectories are unavailable in that case; use `mastra.getAgent()` or `mastra.getWorkflow()` instead of a direct import.
