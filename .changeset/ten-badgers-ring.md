---
'@mastra/core': patch
---

Added a monotonic `stateVersion` and a per-process `stateEpoch` to the agent-controller display state. Session-state snapshots and the `agent_start`, `agent_end`, and `task_updated` events all carry the stamp, so clients can tell which of two states is newer instead of guessing from arrival order or local clocks.
