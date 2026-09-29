---
'@mastra/playground-ui': patch
---

Fixed `PageLayout` `fit` pages overflowing the screen when their content is wider than the page. The body now shrinks to the page width, so callers no longer need a `min-w-0` wrapper.
