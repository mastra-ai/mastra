---
'@mastra/core': patch
---

Stop suspended-run snapshots from growing with step count

A single suspended run persisted one full copy of the model request per step. The request body holds the tool schemas and system instruction, which are invariant across a run, so a HITL agent that made a dozen tool calls before its first approval could push its snapshot past MongoDB's hard 16 MB per-document limit — the write failed, the run was never saved, and the later resume could not find it.

The buffered step state now stores each distinct request once and references it per step, and snapshot pruning drops the request body from retained step history. Snapshot size no longer scales with the number of steps taken before suspending. Snapshots written by earlier versions still load unchanged.
