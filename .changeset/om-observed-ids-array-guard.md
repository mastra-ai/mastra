---
'@mastra/memory': patch
---

Fixed Observational Memory merging the rest of an agent's reply into an already-observed message when another worker recovers the turn (for example after a durable agent's worker crashes). The recovering worker now starts a new message, so the stored conversation matches a run that never crashed. A stored record whose observed message list is not an array no longer crashes the turn with `includes is not a function`.
