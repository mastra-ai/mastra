---
'@mastra/playground-ui': patch
---

If you import `AgentBadge` from `@mastra/playground-ui/domains/chat/tools/badges/agent-badge`, `renderToolCard` is now required. Pass the card you want nested tool calls drawn with:

```tsx
// Before
<AgentBadge {...props} />

// After
import { ToolCard } from '@mastra/playground-ui/domains/chat/tools/tool-card';

<AgentBadge {...props} renderToolCard={cardProps => <ToolCard {...cardProps} />} />
```
