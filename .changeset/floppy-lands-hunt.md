---
'@mastra/mcp-apps-components': minor
---

Added an `editable` option to `createObservabilityDraftSchemas`. With `editable: true`, the schemas accept only widgets a form editor can edit: single reads and two-read formulas, filters on the known dashboard dimensions, the percentiles 0.5, 0.95, and 0.99, and tables of name, value, and change columns. Anything else, such as `rangeTotal`, `emptyWhenZero`, a custom `total`, dimension columns, or `unpricedWhen`, is rejected with a message telling the model what to write instead. Display settings such as `xLabels` and `round` stay allowed.

```ts
const schemas = createObservabilityDraftSchemas(
  { metricNames },
  { kinds: ['kpis', 'timeseries', 'table'], dashboardFilters: false, editable: true },
);
```
