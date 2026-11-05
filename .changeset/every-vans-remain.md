---
'@mastra/playground-ui': minor
---

Added `McpAppHostProvider` to `@mastra/playground-ui/domains/mcps`, so chat hosts can extend the MCP Apps shown in tool cards. A host can add its own keys to each app's host context, and receive each app's raw model context updates along with the app they came from. Host context changes reach the running app without reloading it. Without the provider, MCP Apps work as before.

```tsx
import { McpAppHostProvider } from '@mastra/playground-ui/domains/mcps';

<McpAppHostProvider
  value={{
    hostContext: app => ({ 'my-host/flag': true }),
    onModelContext: (app, { structuredContent }) => console.log(app.toolCallId, structuredContent),
  }}
>
  {chat}
</McpAppHostProvider>;
```
