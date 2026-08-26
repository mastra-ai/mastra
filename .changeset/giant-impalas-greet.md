---
'@mastra/core': patch
---

Fixed workspace search indexing so it can be rebuilt without starting the sandbox.

```typescript
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  bm25: true,
  autoIndexPaths: ['docs'],
});

await workspace.rebuildSearchIndex();
```
