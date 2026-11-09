---
'@mastra/mcp-apps-components': minor
---

Added `observabilityWidgetHost` to `@mastra/mcp-apps-components/host`, so a host page such as Studio's Metrics page can pass its project, date range and filters down to observability widgets. The widgets read over the host's selection instead of the dashboard's defaults, read again when it changes, and send `projectId` with every `queryObservability` call so your server can scope reads to that project. With a `projectId`, the widgets show at project scope; without one, at org scope. A custom range reads over the same window as the Metrics page, and a pinned widget keeps it. Pinning is optional.

```tsx
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
import { observabilityWidgetHost } from '@mastra/mcp-apps-components/host';

const host = observabilityWidgetHost({
  resourceUri: 'ui://mastra/observability-widget',
  projectId,
  datePreset: 'custom', // or '24h' | '3d' | '7d' | '14d' | '30d'
  customRange: { from: new Date('2026-10-01'), to: new Date('2026-10-04') },
  filters: [{ fieldId: 'environment', value: 'production' }],
  // pins: { pinnedIds, onPin, onUnpin },
});

<McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
```

Accept `projectId` in your `queryObservability` tool's input schema and scope the reads with it. It comes from the app's iframe, so check that the caller can access that project before reading.
