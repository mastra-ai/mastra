---
'@mastra/mcp-apps-components': minor
---

Added `createObservabilityWidgetInputSchema`, `observabilityWidgetInputSchema` and `toObservabilityWidget`, so a tool that adds one widget to a saved dashboard accepts the same widget a model writes for `showObservabilityDashboard`, checked and converted the same way.

```ts
import { createObservabilityWidgetInputSchema, toObservabilityWidget } from '@mastra/mcp-apps-components';

const widgetSchema = createObservabilityWidgetInputSchema({ metricNames });
const widget = toObservabilityWidget({
  title: 'Model spend',
  table: { groupBy: ['model'], columns: [/* ... */] },
});
```
