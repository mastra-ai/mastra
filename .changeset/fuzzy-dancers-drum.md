---
'@mastra/factory': minor
---

Added read-only Knowledge browsing to Factory projects. Pass a Knowledge instance with the new `knowledge` option and Factory serves its scope tree, scope graphs, search, node details, and activity feed to project members, showing each member only what their access allows.

```typescript
import { Knowledge } from '@mastra/core/knowledge';
import { MastraFactory } from '@mastra/factory';

const factory = new MastraFactory({
  storage,
  knowledge: { key: 'factory', instance: new Knowledge({ id: 'factory' }) },
});
```

The endpoints live under `/web/factory/projects/:id/knowledge/` (`scopes`, `subgraph`, `search`, `nodes/:nodeId`, and `activity`) and are only registered when `knowledge` is set.
