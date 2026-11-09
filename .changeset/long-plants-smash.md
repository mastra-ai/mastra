---
'@mastra/mcp-apps-components': minor
---

Added `createObservabilityDraftSchemas` and `toObservabilityWidget`, so tools that save dashboards can give a model the same detailed schema the observability dashboard tool uses, instead of an open object it has to guess the shape of.

`createObservabilityDraftSchemas(catalog, options)` returns a `widget` and a `dashboard` schema. Pass `kinds` to offer only some widget kinds, and `dashboardFilters: false` to leave `defaults.filters` out. What you leave out is missing from the JSON schema the model sees. Both functions are exported from `@mastra/mcp-apps-components/dashboards`, which doesn't load the bundled apps.

**Before**

```ts
const addWidget = createTool({
  id: 'addWidget',
  inputSchema: z.object({ widget: z.record(z.string(), z.unknown()) }),
  execute: async ({ widget }) => saveWidget(checkByHand(widget)),
});
```

**After**

```ts
import { createObservabilityDraftSchemas, toObservabilityWidget } from '@mastra/mcp-apps-components/dashboards';

const schemas = createObservabilityDraftSchemas({ metricNames }, { kinds: ['kpis', 'timeseries', 'table'] });

const addWidget = createTool({
  id: 'addWidget',
  inputSchema: schemas.widget,
  // Keeps the widget's id when the model gives one
  execute: async widget => saveWidget(toObservabilityWidget(widget)),
});
```

Invalid widgets are rejected with paths into what the model wrote, such as `timeseries.series.1.value`. Converted widgets pass `strictDashboardWidgetSchema`.

The dashboard tool's input schema is now about 28% smaller, because metric and score filters are written out once instead of at every read. The tool also now rejects a widget whose tabs share a label, which used to open as an error card.
