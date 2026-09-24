---
'@mastra/core': patch
---

Fixed `runEvals` throwing `TypeError: output is not iterable` when a workflow target is given a trajectory-only scorer config (`scorers: { trajectory: [...] }`). Trajectory-only configs on workflow targets now use the workflow scoring path.

`runEvals` now warns when the target isn't registered with a Mastra instance. Registry lookups, score persistence, and trace-based trajectories are unavailable in that case. Use `mastra.getAgent()` or `mastra.getWorkflow()` instead of a direct import.

`runEvals` also warns when two scorers or gates share an id. Results are keyed by id, so duplicates are merged into a single averaged row.
