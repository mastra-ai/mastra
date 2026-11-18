---
'@mastra/playground-ui': patch
---

Exported `KNOWLEDGE_EXPLORER_VIEWS` from `@mastra/playground-ui/domains/knowledge/lib/explorerViews`: the view choices `KnowledgePageExplorer` offers (Tree, Graph, Page), so a host's loading placeholder can show the same tabs.

```tsx
import { KNOWLEDGE_EXPLORER_VIEWS } from '@mastra/playground-ui/domains/knowledge/lib/explorerViews';

export function ExplorerTabsPlaceholder() {
  return KNOWLEDGE_EXPLORER_VIEWS.map(({ value, label, icon }) => (
    <span key={value} aria-hidden>
      {icon}
      {label}
    </span>
  ));
}
```
