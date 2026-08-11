---
'@mastra/factory': patch
---

Fixed the Factory review handoff turning finding numbers into GitHub links. Ordinals like `#1` in a published review auto-linked to unrelated issues; findings are now named by subject and `file:line`.
