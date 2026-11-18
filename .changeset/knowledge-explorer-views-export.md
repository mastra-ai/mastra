---
'@mastra/playground-ui': patch
---

Exported `KnowledgeExplorerToolbar` and `KnowledgeSearchBox` from `@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer`: the view tabs and search that `KnowledgePageExplorer` shows above its panes, so a host can show the same working toolbar while the knowledge graph loads.

```tsx
import {
  KnowledgeExplorerToolbar,
  KnowledgeSearchBox,
} from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';

<KnowledgeExplorerToolbar
  view={view}
  selectedPageId={selectedPageId}
  onViewChange={setView}
  search={<KnowledgeSearchBox source={source} onSelect={setSelectedPageId} />}
/>;
```
