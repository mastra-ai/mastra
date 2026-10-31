---
'@mastra/playground-ui': patch
---

The Knowledge explorer (graph, page and note views, pins, scopes, search) now lives in `@mastra/playground-ui/domains/knowledge`, so Mastra Studio can use the same views as Factory. A host supplies its data through `KnowledgeDataSourceProvider`:

```tsx
import { KnowledgeDataSourceProvider } from '@mastra/playground-ui/domains/knowledge/data-source-provider';

<KnowledgeDataSourceProvider value={dataSource}>
  <KnowledgeViews />
</KnowledgeDataSourceProvider>;
```
