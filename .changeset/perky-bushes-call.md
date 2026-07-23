---
'@mastra/client-js': minor
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added the `transient` option to `sendSignal` params. Set `transient: true` to deliver a signal to the model for the current call only, without retaining it in thread history.

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

await client.getAgent('myAgent').sendSignal({
  resourceId: 'user-1',
  threadId: 'thread-1',
  signal: {
    type: 'reactive',
    contents: 'Stay on the current task.',
    transient: true,
  },
});
```
