---
'@mastra/client-js': patch
---

Added thread-specific task hydration to agent controller session state requests.

```ts
const state = await session.state({ threadId: 'thread-123' });
```
