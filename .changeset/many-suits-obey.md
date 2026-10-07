---
'@mastra/playground-ui': patch
---

Metrics cards that fail to load now say "Couldn't load" in a short, muted line, like the KPI cards, instead of repeating a long red sentence in every card when the API is down. Trace volume and Usage keep their tabs in that state but hide the column header, since there are no rows for it to label. A share list row that the page is filtered to is now announced to screen readers as the current one.
