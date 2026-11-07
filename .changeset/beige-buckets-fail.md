---
'@mastra/mcp-apps-components': minor
---

The observability app now draws a whole dashboard instead of a single widget, with rows of KPIs, time series, tables and scores. The app applies the dashboard's default date range and filters.

The model writes each widget, read and column under a key that names it, and each number holds the read it comes from, such as `{ timeseries: { series: [{ value: { metricTimeSeries: { … } } }] } }`. Nothing points at a query, series or column by id, so a dashboard can't reference something it lacks. A widget with a single view puts it directly on the widget; tabs go in `tabs`. `toObservabilityDashboard` turns this into a regular `dashboardDefinitionSchema` definition, gathering the reads into queries.

**Why:** with a single fixed widget, the model could only show a handful of hard-coded charts. Now it can write its own dashboard against real data, checked against each widget kind's options.

**New helpers**

- `observabilityDashboardInputSchema` lists every widget kind's options, so the model gets clear errors when a widget is wrong. It also names the metrics Mastra records, such as `mastra_agent_duration_ms` and `mastra_model_total_input_tokens`, so the model doesn't guess names that read as zero.
- `createObservabilityDashboardInputSchema({ metricNames })` builds the same schema with the project's metric names as the only allowed values, so a dashboard can't name a metric without data. Rebuild the tool when the names change.
- `toObservabilityDashboard(input)` gives each widget without an id a fresh UUID, makes a widget without a `span` full width, and checks the result.
- `OBSERVABILITY_READ_ACTIONS` lists every `MastraClient` read the app sends to `queryObservability`, from `aggregateTraces` to `listScores`. Allow exactly these with `z.enum(OBSERVABILITY_READ_ACTIONS)`, so no widget fails for a missing action.

**Renamed:** `observabilityWidgetApp` is now `observabilityDashboardApp`, named `Observability dashboard`.

**Before**

```ts
outputSchema: z.object({ widget: z.unknown(), datePreset: z.string().optional() }),
execute: async ({ widget, datePreset }) => ({ widget: WIDGETS[widget], datePreset }),
```

**After**

```ts
import {
  observabilityDashboardInputSchema,
  observabilityDashboardOutputSchema,
  toObservabilityDashboard,
} from '@mastra/mcp-apps-components';

createTool({
  id: 'showObservabilityDashboard',
  inputSchema: observabilityDashboardInputSchema,
  outputSchema: observabilityDashboardOutputSchema,
  execute: async input => toObservabilityDashboard(input),
});
```

Pins now also carry the dashboard's default filters as `filters`. `@mastra/core` and `zod` are now peer dependencies.
