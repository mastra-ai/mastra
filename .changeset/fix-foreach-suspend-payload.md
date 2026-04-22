---
"@mastra/core": patch
---

Fixed `foreach` parallel iterations losing their `suspendPayload` when a sibling iteration was resumed. Previously, every result entry written back to the workflow snapshot had its `suspendPayload` cleared, so iterations that were still suspended (e.g. parallel tool-call approvals each carrying an agent's `__streamState`) lost the context they needed to resume correctly. Suspended iterations now retain their `suspendPayload` across resume cycles; completed iterations still have it cleared to keep snapshots small.

```ts
const approvalWorkflow = createWorkflow({ id: 'approve' })
  .foreach(approveToolStep, { concurrency: 5 })
  .commit();

// Before: resuming the first approval wiped streamState on the others,
//         so subsequent resumes lost conversation context.
// After:  each suspended iteration keeps its suspendPayload (including
//         streamState) until it is individually resumed.
```
