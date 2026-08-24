---
'@mastra/valkey-streams': minor
---

Add a GLIDE-backed Valkey Streams PubSub and lease provider.

```typescript
import { ValkeyStreamsPubSub } from '@mastra/valkey-streams';

const pubsub = new ValkeyStreamsPubSub({ url: 'valkey://localhost:6379' });
```
