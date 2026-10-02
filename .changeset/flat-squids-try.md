---
'@mastra/core': patch
---

Fixed duplicate evented workflow step execution after broker redelivery.
A redelivered `workflow.step.run` for a step that already ran is no longer executed again, and a redelivery that finds a step recorded as running — left behind by a worker that died or by a failed write — resumes that step instead of being dismissed as a duplicate.
