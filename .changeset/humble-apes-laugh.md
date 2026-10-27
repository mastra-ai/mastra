---
'@mastra/playground-ui': patch
---

Fixed Metrics charts for ranges longer than 14 days dropping the first day and mislabeling days when the browser isn't on UTC. Daily bars now line up with the server's UTC days and are labeled by their UTC date, so chart totals match the KPI cards. Metrics numbers also read better at large scales: counts over a billion show as `13.0B` instead of `13036.9M`, and durations over a minute show as `4.5m` or `3.6h` instead of `12817.1s`.
