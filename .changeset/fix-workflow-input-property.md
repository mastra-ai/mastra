---
'@mastra/core': patch
---

Fix workflow input property preservation after resume from snapshot

Ensure that when resuming a workflow from a snapshot, the input property is correctly set from the snapshot's context input rather than from resume data. This prevents the loss of original workflow input data during suspend/resume cycles.