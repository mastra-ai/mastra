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

Added `__getOverridableFields()` internal method to the `Agent` class, returning a snapshot of field values (instructions, model, tools, workspace) that may be overridden by stored editor configurations. Widened the signatures of `__updateInstructions`, `__updateModel`, and `__setTools` to accept dynamic argument types, allowing the editor to restore original dynamic/function-based field values.
