---
'@mastra/mcp-apps-components': minor
---

Added `observabilityWidgetApp`, an MCP App that draws one observability dashboard widget (KPIs, time series, table or scores) with the same components as Studio. The model opens it with a tool whose result is `{ widget, datePreset }`. The app then reads its data through an app-only `queryObservability` tool (`QUERY_OBSERVABILITY_TOOL`) that you write, so you choose which Mastra server it reads from and how it authenticates.

```ts
import { MCPServer } from '@mastra/mcp';
import { QUERY_OBSERVABILITY_TOOL, observabilityWidgetApp } from '@mastra/mcp-apps-components';

new MCPServer({
  id: 'observability',
  name: 'Observability',
  version: '1.0.0',
  appResources: { 'ui://mastra/observability-widget': observabilityWidgetApp },
  tools: { showObservabilityWidget, [QUERY_OBSERVABILITY_TOOL]: queryObservability },
});
```

The tool receives `{ action, args }`, where `action` is a `MastraClient` observability method such as `getMetricAggregate`, and returns `{ data }`, that method's result. See the package README for a full example.
