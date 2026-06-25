---
'@mastra/libsql': patch
---

Fixed `persistWorkflowSnapshot` resetting a workflow run's `createdAt` on every re-persist. The default execution engine re-persists a run's snapshot on every step, so `createdAt` drifted to the last activity time and jumped forward on suspend/resume. Re-persisting now preserves the original `createdAt` and only advances `updatedAt`, so `listWorkflowRuns` ordering, fromDate/toDate filters, and the creation time shown in Studio stay correct.
