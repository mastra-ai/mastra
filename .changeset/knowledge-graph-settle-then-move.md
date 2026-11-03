---
'@mastra/playground-ui': patch
'mastra': patch
---

Focusing a page in the Knowledge graph keeps the current layout while the pages it needs load (with a "Loading pages…" note after 150ms), then moves to the new layout once, so the transition shows instead of animating on stale data.
