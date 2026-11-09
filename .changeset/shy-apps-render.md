---
'@mastra/react': minor
---

Added MCP Apps to Generative UI. When an agent calls an MCP tool that serves an app (a tool with a `ui://` resource), `useGenUIChat` now renders the app in place of the tool card, the same way Studio does.

- The app receives the tool's input and result.
- The app can call tools on its own MCP server. Tools the server keeps for the model (`visibility: ['model']`) are refused.
- Messages the app sends go to the agent as user messages.
- Context the app shares with the model is attached to the user's next message only, marked as untrusted data, and kept out of the system prompt. Your `Text` renderer never sees it; use `isMcpAppContextText` to filter it elsewhere.
- If the app's HTML can't be loaded, the tool shows the registry's fallback.

Pass a view to `createGenUI` to turn it on. `McpAppView` from the new `@mastra/react/mcp-apps` entry point hosts each app in a sandboxed iframe. It needs `@mcp-ui/client` 7.1 in your app, which stays optional for everyone else.

```tsx
import { createGenUI, useGenUIChat } from '@mastra/react/gen-ui';
import { McpAppView } from '@mastra/react/mcp-apps';

const genUI = createGenUI({
  catalog,
  components,
  mcpApps: { view: McpAppView },
});

function Chat() {
  const chat = useGenUIChat({ agentId: 'dashboard-agent', genUI });
  return chat.messages.map(m => <MessageFactory key={m.id} message={m} {...chat.genUI.renderers} />);
}
```
