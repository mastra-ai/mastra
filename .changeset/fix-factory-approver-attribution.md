---
'@mastra/factory': patch
---

Fix: Attribute approved Factory runs to the approver, not the repo connector. The approve route now persists `approved_by` on the deferred decision, session preparation prefers the approver's identity over the repository connector's, and `prepareRunStart` stamps only the starting role's session instead of repointing every role. Closes #22254.
