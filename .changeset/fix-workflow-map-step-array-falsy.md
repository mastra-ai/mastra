---
'@mastra/core': patch
---

Fix the workflow `.map()` step-array form resolving to `null` when the executed branch arm returns a falsy value. The mapping selected the executed arm with a truthiness/emptiness check, which dropped valid falsy outputs (`{}`, `0`, `false`, `""`) and left the mapping as `null`. It now selects the arm whose `getStepResult` is not `null`, matching how step results are marked.
