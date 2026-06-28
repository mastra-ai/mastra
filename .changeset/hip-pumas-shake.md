---
'@mastra/core': patch
---

Fixed approved and declined tool approvals not round-tripping on recall.

After a `requireApproval` tool call was approved or declined, `memory.recall()` lost the decision: a decline was stored as a normal successful result (`state: 'result'` with the rejection string) and an approval dropped the approval entirely. Now:

- **Declined** calls persist as `state: 'output-denied'` with `approval: { id, approved: false, reason }`, so recalled AI SDK v6 UI parts render as `output-denied`. In v4 and v5 (which have no denied state) the call downgrades to a single `output-available` (v5) / result (v4) part whose output is the decline reason — so the agent's onFinish memory save no longer throws `ToolInvocation must have a result`.
- **Approved** calls keep `approval: { id, approved: true }` alongside the result, so v6 UI parts carry the approval.

Live approve/decline already worked; this was a write-path persistence gap. Fixes #17218.
