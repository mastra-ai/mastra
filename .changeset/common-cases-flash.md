---
'@mastra/playground-ui': patch
---

Fixed the filter bar on pages like Metrics staying in place while the page scrolled, which cut off the content scrolling under it. A `PageLayout` `actionRow` now scrolls away with the page body; pages whose list scrolls on its own look the same as before.
