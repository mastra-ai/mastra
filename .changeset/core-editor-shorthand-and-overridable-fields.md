---
'@mastra/core': minor
---

Added `editor` shorthand to `MastraCompositeStore` for routing all editor-related domains (agents, prompt blocks, scorer definitions, MCP clients, MCP servers, workspaces, skills) to a single storage backend. Priority: `domains` > `editor` > `default`.

```typescript
import { MastraCompositeStore } from '@mastra/core/storage';

new MastraCompositeStore({
  id: 'composite',
  default: postgresStore,
  editor: filesystemStore,
});
```

Improved code-agent editing so editor overrides can be applied and reverted without losing original dynamic values for fields like instructions, model, and tools.
