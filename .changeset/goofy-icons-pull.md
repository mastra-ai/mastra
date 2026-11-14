---
'@mastra/core': patch
---

Fixed `foreach` items receiving another item's resume data when a run is restarted while one item is being resumed. Items that were still suspended stay suspended until they are resumed, and items the `foreach` had not reached start without resume data. This also holds for a `foreach` inside a nested workflow, for a `foreach` whose items are nested workflows, and when the resume was handled by the same `Mastra` instance that suspended the run. For a `DurableAgent` that delegates to several sub-agents whose tools need approval, approving one delegation and then recovering the run after a crash no longer runs the other sub-agents' tools without their approval.

Fixed resuming one item of a `foreach` inside a nested workflow by index, for example `run.resume({ step: ['child-workflow', 'approve'], forEachIndex: 1, resumeData })`, resuming every suspended item of that `foreach` with the same resume data.

Runs interrupted while resuming a `foreach` item or a nested workflow on an earlier version don't record what was resumed. On restart, the suspended items and steps stay suspended, so resume the interrupted one again.
