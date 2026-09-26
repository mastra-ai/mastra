---
'@mastra/core': patch
---

Fixed saved dynamic workflows losing `.map()` entries that use `initData: true`. These mappings now keep reading from the workflow's initial input after the workflow is saved and loaded again, the same as they do in memory. Workflows saved before this fix need to be saved again.
