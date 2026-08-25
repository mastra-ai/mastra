---
'@mastra/valkey': minor
---

Add a GLIDE-backed Valkey storage and server cache integration.

```typescript
import { ValkeyStore } from '@mastra/valkey';

const storage = new ValkeyStore({ id: 'storage', host: 'localhost' });
```
