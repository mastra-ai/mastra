---
'@mastra/turso': minor
'@mastra/libsql': patch
---

Added native Turso Database file storage for Mastra agents, workflows, memory, and other storage domains.

```typescript
import { TursoStore } from '@mastra/turso';

const storage = new TursoStore({
  id: 'local-storage',
  path: './mastra.db',
});
```
