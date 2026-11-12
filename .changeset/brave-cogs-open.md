---
'@mastra/mcp-apps-components': minor
---

Added an optional `onConfigure` callback to `observabilityWidgetHost`. When a host passes it, each widget in the observability widget app shows a settings button. Clicking it hands the host the widget along with the date preset, custom range and filters it is drawn with, so the host can open its own settings dialog for that widget.

```tsx
import { observabilityWidgetHost } from '@mastra/mcp-apps-components/host';

const host = observabilityWidgetHost({
  resourceUri: 'ui://mastra/observability-widget',
  onConfigure: ({ widget, datePreset, filters }) => openWidgetSettings(widget, datePreset, filters),
});
```
