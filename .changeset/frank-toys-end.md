---
'@mastra/playground-ui': minor
'@mastra/client-js': patch
'@mastra/core': patch
---

Added helpers that turn an observability list page's URL into a saved view and apply a saved view back to the URL (`savedViewFromSearchParams`, `applySavedView`). Parts of a view the page no longer supports, such as a removed filter field or column, are dropped one by one and the rest still applies. The spans and threads pages now keep their time range, filters and sort in the URL, so they survive a reload and can be shared.
