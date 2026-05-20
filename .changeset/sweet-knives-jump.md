---
'@mastra/playground-ui': minor
---

Added a custom date range option to the Metrics page date picker. You can now filter metrics by an arbitrary start and end date and time, matching the Traces page, alongside the existing relative presets (last 24 hours, 3, 7, 14, and 30 days).

The selected range is reflected in the URL so it can be bookmarked or shared:

```
/metrics?period=custom&dateFrom=2026-05-01T00:00:00.000Z&dateTo=2026-05-07T23:59:59.999Z
```
