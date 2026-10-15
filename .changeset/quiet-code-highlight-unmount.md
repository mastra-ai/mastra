---
'@mastra/playground-ui': patch
---

Fixed code blocks updating state after they are removed from the page, which could throw `window is not defined` in tests.
