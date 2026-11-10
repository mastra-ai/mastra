---
'@mastra/playground-ui': patch
---

Metrics card groups of three or more now use three columns from 48rem wide instead of staying on two until 56rem, so three KPIs sit on one row on medium-width dashboards instead of wrapping 2 + 1. Groups of one or two cards keep two columns, and groups of exactly four keep their 2 + 2 layout at that width.
