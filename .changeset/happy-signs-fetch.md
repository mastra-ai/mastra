---
'@mastra/playground-ui': minor
---

Widened what dashboard widgets can show:

- KPIs can combine values with `ratio`, `minus`, `max` and `coalesce`, read trace and span aggregates (for example `duration.p95`) and score aggregates, and are formatted as `duration`, `percent` or `score`. Combined values are compared with the previous window.
- Charts accept six more colors: `blue`, `orange`, `pink`, `yellow`, `red` and `purple`.
- KPI `icon` and `detail`, series `color` and table `emptyMessage` are optional. Series without a color pick one from a palette, and tables without an empty message show "No data".
