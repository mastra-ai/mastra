---
'@mastra/playground-ui': patch
'@mastra/mcp-apps-components': patch
---

Shrank the observability explorer and trace viewer MCP Apps back under their size budget. A recorded sub-agent card no longer pulls in the live chat's tool card (and with it the MCP app viewer, form and workflow graph code), and the apps keep the trace panels' recorded tool cards instead of Studio's live ones.

If you import `AgentBadge` from `@mastra/playground-ui/domains/chat/tools/badges/agent-badge`, `renderToolCard` is now required. Pass the card you want nested tool calls drawn with:

```tsx
// Before
<AgentBadge {...props} />

// After
import { ToolCard } from '@mastra/playground-ui/domains/chat/tools/tool-card';

<AgentBadge {...props} renderToolCard={cardProps => <ToolCard {...cardProps} />} />
```
