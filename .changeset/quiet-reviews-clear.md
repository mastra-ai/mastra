---
'@mastra/factory': patch
---

Factory now dismisses its own stale change requests when it approves a pull request. Previously, if an earlier Factory review requested changes and a later Factory review (from a different reviewer identity) approved the repaired PR, GitHub kept the PR blocked at "changes requested". Only change requests left by the Factory GitHub App before the approval are dismissed; human reviews are never touched.
