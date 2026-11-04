---
'@mastra/playground-ui': minor
---

Improved MCP Apps support in Studio:

- Studio now tells apps that it can run server tools and post chat messages, so apps that check host capabilities before using these features (for example, a chart's "View in traces" button) now show them.
- MCP App views now accept context updates from the app (`ui/update-model-context`) through a new `onUpdateModelContext` callback, and only advertise that capability when the callback is provided.
- An app can call any tool on its own server from the MCP tool playground (previously every call ran the tool being viewed).
- Apps can no longer call tools their server keeps for the model only (`_meta.ui.visibility: ['model']`); those calls are refused without running the tool.
- Apps now receive object tool outputs as `structuredContent`, with the JSON text kept alongside it, so apps that render from structured data work in Studio.
- Links an app asks Studio to open must be `http` or `https`; others (such as `javascript:` or `file:`) are refused.
- Apps follow Studio's light or dark theme.

```tsx
import { McpAppViewer } from '@mastra/playground-ui/domains/mcps/components/mcp-app-viewer';

<McpAppViewer
  html={html}
  toolName="showObservabilityDashboard"
  onToolCall={(name, args) => callServerTool(name, args)}
  onUpdateModelContext={context => setNextTurnContext(context)}
/>;
```
