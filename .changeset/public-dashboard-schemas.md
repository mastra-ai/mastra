---
'@mastra/playground-ui': minor
---

The dashboards entry point (`@mastra/playground-ui/domains/dashboards`) now exports the schemas a widget is validated with, so an app that edits stored dashboard widgets can check its changes against the same rules the renderer uses.

- Options schemas for each built-in widget kind: `kpisOptionsSchema`, `kpiItemSchema`, `tableOptionsSchema`, `tableColumnOptionsSchema`, `timeseriesOptionsSchema`, `timeseriesSeriesSchema` and `scoresOptionsSchema`, with their types.
- Value expression schemas and types: `valueExprSchema`, `valueRefSchema`, `queryRefSchema`, `ValueExpr`, `ValueRef` and `LabelledValue`.
- The allowed formats, colors and KPI icons: `VALUE_FORMATS`, `formatSchema`, `CHART_COLOR_NAMES`, `SERIES_COLORS`, `colorSchema`, `KPI_ICONS`, and the `ValueFormat`, `ChartColorName` and `KpiIcon` types.

```ts
import { kpisOptionsSchema, valueExprSchema } from '@mastra/playground-ui/domains/dashboards';

kpisOptionsSchema.parse({ items: [{ label: 'Runs', format: 'count', value: { query: 'runs' } }] });
```
