---
'@mastra/memory': patch
---

Fixed reflected observation ranges so they are never saved in reverse order.

Preserved every source range a reflected section actually drew from, instead of only the one named in its heading.

Kept message ID ranges compact so they do not grow with each reflection.
