---
'@mastra/mcp-apps-components': minor
'@mastra/playground-ui': patch
---

Changed dashboard widget pinning to use standard MCP Apps messages, and added a `useMcpAppHost` hook for React hosts.

**What changed**

When the user clicks a pin button, the dashboard app now sends `ui/update-model-context` with the full list of widgets the user wants pinned, under `mastra.ai/dashboard-pinned-widgets` in `structuredContent`. Each entry is `{ widget, scope, defaults }`. It no longer sends the custom `mastra.ai/dashboard-widget-pin` notification, so any MCP Apps host can support pinning without handling a Mastra-only message. Pin buttons now show only when the host holds an array under that key in its host context and advertises `updateModelContext.structuredContent`. Pins and drilldowns share one model context, so neither erases the other.

`DASHBOARD_WIDGET_PIN_NOTIFICATION` and `dashboardWidgetPinNotificationParamsSchema` are removed. Use `dashboardPinnedWidgetsSchema` instead.

Before:

```typescript
bridge.fallbackNotificationHandler = async ({ method, params }) => {
  if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
  const parsed = dashboardWidgetPinNotificationParamsSchema.safeParse(params);
  // ...apply one pin or unpin
};
```

After:

```typescript
bridge.onupdatemodelcontext = async ({ structuredContent }) => {
  if (!structuredContent || !(DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY in structuredContent)) return {};
  const parsed = dashboardPinnedWidgetsSchema.safeParse(structuredContent[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]);
  // ...store the full list of pinned widgets
  return {};
};
```

**New `@mastra/mcp-apps-components/host` subpath**

React hosts built on `@mastra/playground-ui` can use `useMcpAppHost` to wire pinning without handling the messages themselves. The subpath doesn't include the app's HTML.

```tsx
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
import { useMcpAppHost } from '@mastra/mcp-apps-components/host';

const host = useMcpAppHost({ dashboardPins: { pinnedIds, onPinnedChange } });
<McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
```
