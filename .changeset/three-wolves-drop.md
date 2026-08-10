---
'@mastra/core': minor
---

Added an explicit A2A Protocol v1.0 SDK export while preserving the existing v0.3 export.

```typescript
import { ListTasksRequest } from '@mastra/core/a2a/v1';

const request = ListTasksRequest.fromJSON({ pageSize: 20 });
```
