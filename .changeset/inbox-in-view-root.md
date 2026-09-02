---
'@mastra/playground-ui': patch
---

`useInView` accepts an optional `root` ref so infinite-scroll sentinels can observe a list's own scroll viewport instead of the window. The Studio `/inbox` page now uses the shared `PageLayout`, `Tabs`, and `DataList` components with per-list scrolling and infinite loading for feedback.
