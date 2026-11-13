---
'@mastra/mcp-apps-components': minor
---

Added two MCP Apps built from Studio's observability pages, served by the built-in MCP server through its observability tools:

- **Trace viewer** (`@mastra/mcp-apps-components/trace-viewer`): draws a trace on Studio's timeline and opens each span's details.
- **Observability explorer** (`@mastra/mcp-apps-components/observability-explorer`): Studio's Traces, Spans, Threads, Logs, and Metrics pages as tabs, with filters, time range, sort, paging, and drilldowns from metrics into traces or logs. Selecting a row opens it on the timeline. The model's query filters show up as filter-bar chips; conditions the bar can't represent stay applied and are listed above the list. The Metrics tab opens on the time range and filters of the `analyze_metrics` call that opened it, and names any filters the dashboard can't apply.

Both apps work with the conversation in hosts that support it. They tell the model which trace, span, filters, or log are open. **Ask about this** buttons on a trace, span, or log send a message about it, and the apps have a **Fullscreen** button and, when the server sends Studio's URL, an **Open in Studio** button. Apps also report the package version to the host when they connect.

To serve them from your own `MCPServer`, register them as app resources:

```ts
import { MCPServer } from '@mastra/mcp';
import { traceViewerApp } from '@mastra/mcp-apps-components/trace-viewer';

const server = new MCPServer({
  name: 'my-server',
  version: '1.0.0',
  tools,
  appResources: { 'ui://mastra/trace-viewer': traceViewerApp },
});
```
