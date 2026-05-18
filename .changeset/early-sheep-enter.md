---
'@mastra/core': patch
---

Fixed Session.message() duplicate detection so default changes do not affect messages that omitted mode or model, while explicit overrides still apply.
