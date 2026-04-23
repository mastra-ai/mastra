---
'@mastra/agent-browser': patch
---

Fixed `browser_evaluate` so expression scripts now return their computed value instead of `undefined` (for example, `document.querySelectorAll('a').length`).
