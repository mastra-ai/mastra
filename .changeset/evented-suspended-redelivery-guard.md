---
'@mastra/core': patch
---

Fixed a redelivery race on the evented engine where a `workflow.step.run` event redelivered by an at-least-once transport after the step had already suspended would re-execute the step and overwrite the stored suspended record, stripping the suspendPayload that resume recovery depends on. The mid-step pre-write now drops a non-resume delivery when both the run and the target step record are suspended — a state in which no legitimate delivery exists — so the suspended record and its resume artifact survive redelivery. The check is a read-then-write that narrows the race window; fully closing it would need compare-and-set support on `updateWorkflowResults` across storage adapters.
