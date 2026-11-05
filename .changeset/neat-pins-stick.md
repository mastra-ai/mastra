---
'@mastra/mcp-apps-components': minor
---

Added pinning to `observabilityWidgetApp`. When the chat host supports it, the widget shows a pin button, and the host decides what stays pinned. Hosts built on `@mastra/playground-ui` can use `observabilityWidgetPins` from the new `@mastra/mcp-apps-components/host` entry:

```tsx
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';
import { observabilityWidgetPins } from '@mastra/mcp-apps-components/host';

const host = observabilityWidgetPins({
  resourceUri: 'ui://mastra/observability-widget',
  pinnedIds,
  onPin: ({ widget, datePreset }) => savePin(widget, datePreset),
  onUnpin: widgetId => removePin(widgetId),
});

<McpAppHostProvider value={host}>{chat}</McpAppHostProvider>;
```
