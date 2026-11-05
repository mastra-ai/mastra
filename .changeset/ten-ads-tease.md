---
'@mastra/mcp-apps-components': minor
'@mastra/playground-ui': patch
---

Added widget pinning to the dashboard app over standard MCP Apps messages, and a `useMcpAppHost` hook for React hosts.

The host sets `mastra.ai/dashboard-pinned-widgets` in its host context to the ids of the widgets it has pinned and advertises `updateModelContext.structuredContent`; each widget then shows a pin button. When the user clicks one, the app sends `ui/update-model-context` with the full list of widgets the user wants pinned under the same key in `structuredContent`. Each entry is `{ widget, scope, defaults? }`; parse it with `dashboardPinnedWidgetsSchema`. The host echoes the update's `mastra.ai/dashboard-pin-request` number back in its host context, so the app knows a declined pin was answered. Pins and drilldowns share one model context, so neither erases the other.

**Breaking:** the `mastra.ai/dashboard-widget-pin` notification is gone, along with the `DASHBOARD_WIDGET_PIN_NOTIFICATION` and `dashboardWidgetPinNotificationParamsSchema` exports. Hosts that handled it now read the pinned list from `ui/update-model-context` instead.

```ts
// Before
bridge.fallbackNotificationHandler = async ({ method, params }) => {
  if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
  const pin = dashboardWidgetPinNotificationParamsSchema.parse(params);
};

// After
bridge.onupdatemodelcontext = async ({ structuredContent }) => {
  const pinned = dashboardPinnedWidgetsSchema.safeParse(structuredContent?.[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]);
  return {};
};
```

React hosts built on `@mastra/playground-ui` can use `useMcpAppHost` from the new `@mastra/mcp-apps-components/host` subpath to wire pinning without handling the messages themselves. The subpath doesn't include the app's HTML.

```tsx
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
import { useMcpAppHost } from '@mastra/mcp-apps-components/host';

const host = useMcpAppHost({ dashboardPins: { pinnedIds, onPinnedChange } });
<McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
```
