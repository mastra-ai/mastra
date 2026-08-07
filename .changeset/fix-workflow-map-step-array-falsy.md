---
'@mastra/core': patch
---

Fixed workflow `.map()` step arrays so they preserve branch results of `{}`, `0`, `false`, and empty strings instead of returning `null`.
