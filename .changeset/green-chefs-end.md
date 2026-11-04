---
'@mastra/mcp-apps-components': minor
---

Added widget pinning to the dashboard MCP App. Hosts that set `mastra.ai/dashboard-pinned-widgets` in their host context to the ids of their pinned widgets get a pin button on each widget. Clicking it sends a `mastra.ai/dashboard-widget-pin` notification with the widget, the dashboard's scope, and `isPinned`, and each button follows the ids the host sends back, so the host and the app stay in sync. `DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY` and `DASHBOARD_WIDGET_PIN_NOTIFICATION` are exported from `@mastra/mcp-apps-components/dashboard-renderer`.

```typescript
bridge.fallbackNotificationHandler = async ({ method, params }) => {
  if (method !== DASHBOARD_WIDGET_PIN_NOTIFICATION) return;
  const { widget, isPinned } = params as DashboardWidgetPinNotificationParams;
  pinnedIds = isPinned ? [...pinnedIds, widget.id] : pinnedIds.filter(id => id !== widget.id);
  bridge.setHostContext({ [DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY]: pinnedIds });
};
```
