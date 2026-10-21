---
'@mastra/factory': minor
---

Added an optional `browser` setting to `MastraFactory` so Factory session agents can use browser tools. The browser must be thread-scoped so sessions never share pages or cookies.

```ts
import { AgentBrowser } from '@mastra/agent-browser';

new MastraFactory({
  storage,
  browser: new AgentBrowser({ headless: true, scope: 'thread' }),
});
```
