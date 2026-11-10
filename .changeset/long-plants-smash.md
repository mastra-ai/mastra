---
'@mastra/mcp-apps-components': minor
---

Added `createObservabilityDraftSchemas`, so tools that save dashboards can build the widget and dashboard schemas from one catalog, and offer a model only the choices they accept.

`createObservabilityDraftSchemas(catalog, options)` returns a `widget` and a `dashboard` schema. Pass `kinds` to offer only some widget kinds, and `dashboardFilters: false` to leave `defaults.filters` out. What you leave out is missing from the JSON schema the model sees, and rejected if the model writes it anyway. The draft schemas and converters are also exported from `@mastra/mcp-apps-components/dashboards`, which doesn't load the bundled apps.

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

Invalid widgets are rejected with paths into what the model wrote, such as `timeseries.series.1.value`. When `toObservabilityWidget` throws, the error's `cause` is the `ZodError` with those paths. Converted widgets pass `strictDashboardWidgetSchema`.

The widget and dashboard input schemas are about 28% smaller, because metric and score filters are written out once instead of at every read. They also now reject a widget whose tabs share a label, which used to open as an error card.
