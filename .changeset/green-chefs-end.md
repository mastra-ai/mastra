---
'@mastra/mcp-apps-components': minor
---

Added widget pinning to the dashboard MCP App. Hosts that set `mastra.ai/dashboard-pinned-widgets` in their host context to the ids of their pinned widgets get a pin button on each widget. Clicking it sends a `mastra.ai/dashboard-widget-pin` notification with the widget, the dashboard's scope, the date range and filters the user had on (as dashboard `defaults`), and `isPinned`, so the host can render the widget on its own as the user saw it. Each button follows the ids the host sends back, so the host and the app stay in sync.

`DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY`, `DASHBOARD_WIDGET_PIN_NOTIFICATION`, and `dashboardWidgetPinNotificationParamsSchema` are exported from `@mastra/mcp-apps-components/dashboard-renderer`. Parse the params with the schema, since they come from the app's iframe:

```typescript
bridge.fallbackNotificationHandler = async ({ method, params }) => {
  if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
  const parsed = dashboardWidgetPinNotificationParamsSchema.safeParse(params);
  if (!parsed.success) return;
  const { widget, isPinned } = parsed.data;
  const pinned = hostContext[DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY];
  if (isPinned === pinned.includes(widget.id)) return;
  const ids = isPinned ? [...pinned, widget.id] : pinned.filter(id => id !== widget.id);
  hostContext = { ...hostContext, [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: ids };
  bridge.setHostContext(hostContext);
};
```
