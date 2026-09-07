---
'@mastra/core': patch
---

Added `MASTRA_MESSAGE_AUTHOR_KEY` to `@mastra/core/request-context`. Set it from your auth middleware to `{ id, name?, avatarUrl? }` and every message an agent-controller session sends on that request (`sendMessage`, `steer`, `followUp`) is stored with that sender under `providerMetadata.mastra.author`, so a thread several people share can show who wrote what.

```typescript
import { MASTRA_MESSAGE_AUTHOR_KEY } from '@mastra/core/request-context';

requestContext.setRaw(MASTRA_MESSAGE_AUTHOR_KEY, { id: user.id, name: user.name, avatarUrl: user.avatarUrl });
```
