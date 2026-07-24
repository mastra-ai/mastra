---
'@mastra/core': patch
---

Fixed listSuspendedRuns() and sendToolApproval()'s storage fallback returning nothing for durable/evented agents. Discovery only queried workflow snapshots under the in-process loop's name ("agentic-loop"), but createEventedAgent persists runs under "durable-agentic-loop", so suspended runs were never found and approvals couldn't be routed after a restart. Discovery now queries both workflow names and understands the durable snapshot shape: the owning agent id and thread/resource info are read from the serialized workflow input, and top-level approval suspend payloads are reported as approval-requiring tool calls.
