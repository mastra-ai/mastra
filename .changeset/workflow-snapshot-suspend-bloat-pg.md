---
'@mastra/pg': patch
---

Cut per-step workflow snapshot update cost in the PostgreSQL storage adapter.

`updateWorkflowResults` and `updateWorkflowState` previously read the entire snapshot row over the wire, parsed it, merged the change in Node, and rewrote the whole row on every step update — so each step paid the cost of the cumulative snapshot. The adapter now applies these updates with `jsonb_set` / `||` against the row in-place, so only the new step-result fragment crosses the wire. The transactional read-and-merge path is kept for foreach iteration results (where element-wise array merging is required) and as a fallback when the row does not exist yet.

Related to [#17738](https://github.com/mastra-ai/mastra/issues/17738).
