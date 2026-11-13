---
'@mastra/playground-ui': patch
---

Fixed the `PageLayout` action row staying in place while the page scrolled, which cut off content scrolling under it (for example the cards on Metrics). The action row now scrolls with the page body. Pages whose list scrolls on its own look the same as before.
