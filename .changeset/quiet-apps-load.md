---
'@mastra/react': minor
---

Added `useMcpAppHtml` to `@mastra/react/hooks/mcps`. It loads the HTML of an MCP tool's `ui://` app resource so you can render the tool's own UI, and skips the request when the tool has no app.

```tsx
import { useMcpAppHtml } from '@mastra/react/hooks/mcps';

const { data: html } = useMcpAppHtml({ serverId, appResourceUri: 'ui://weather/map' });
```
