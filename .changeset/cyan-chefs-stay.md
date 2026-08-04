---
'@mastra/core': patch
---

Fixed durable agents losing track of parallel sub-agent approvals. When a durable supervisor delegated to multiple sub-agents in parallel and more than one required approval, only the first approval was persisted — the rest disappeared from the conversation metadata. Also fixed listSuspendedRuns() never returning suspended durable agent runs. Both parallel approvals now persist, the suspended run is discoverable, and the approvals can be resumed in any order.
