---
'@mastra/factory': patch
---

Fixed the work item audit trail for custom-board phases. Stage moves now record the phase they came from, and a commit that stays in the same phase no longer records a phantom stage move.
