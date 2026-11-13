---
'@mastra/mcp-apps-components': minor
---

Added an `editable` option to `createObservabilityDraftSchemas`. With `editable: true`, the schemas accept only widgets a form editor can edit: single reads and two-read formulas, filters on the known dashboard dimensions, the percentiles 0.5, 0.95, and 0.99, and tables of name, value, and change columns. Anything else is rejected with a message telling the model what to write instead.

```ts
const schemas = createObservabilityDraftSchemas(
  { metricNames },
  { kinds: ['kpis', 'timeseries', 'table'], dashboardFilters: false, editable: true },
);
```
