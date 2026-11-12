---
'@mastra/server': minor
---

The built-in MCP server now shows observability results as Studio views in clients that render MCP Apps, such as the Claude app:

- `get_trace` opens Studio's trace viewer: the timeline, with each span's details on click.
- `query_traces`, `list_traces`, `list_logs`, and `analyze_metrics` open Studio's trace explorer, with Traces, Spans, Threads, Logs, and Metrics tabs. The model's filters stay applied and show up as filter-bar chips the user can edit. Each tab appears only when the store keeps that data and the caller can use the tools that read it.
- When an app shows a result, the model gets a compact text summary and the app gets the full rows as `structuredContent`, cutting model context for these tools by roughly 5–8x.

Install `@mastra/mcp-apps-components` to turn it on. Clients without MCP Apps support get the same tools and JSON results as before.

```bash
npm install @mastra/mcp-apps-components
```

Two new `server.mcp` options: `apps: false` turns the apps off, and `studioUrl` sets where the apps' **Open in Studio** button points. Under `mastra dev`, `studioUrl` defaults to the local Studio.

```typescript title="src/mastra/index.ts"
export const mastra = new Mastra({
  server: {
    mcp: { studioUrl: 'https://studio.example.com' },
  },
})
```
