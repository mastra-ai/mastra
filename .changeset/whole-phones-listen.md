---
'@mastra/core': patch
---

Added `server.agentSseHeartbeatMs` to configure the default 25-second keepalive interval. The value must be an integer from `0` through `2_147_483_647`. Set it to `0` to disable keepalive comments:

```typescript
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  server: {
    agentSseHeartbeatMs: 0,
  },
});
```
