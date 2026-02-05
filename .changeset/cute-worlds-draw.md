---
'@mastra/core': patch
---

Fixed sub-agent tool approval and suspend events not being surfaced to the parent agent stream. This enables proper suspend/resume workflows and approval handling when nested agents require tool approvals.

Related to issue `#12552`.
