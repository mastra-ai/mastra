---
'@mastra/editor': minor
---

Added `FilesystemStore`, a file-based storage adapter for editor domains. Stores agent configurations, prompt blocks, scorer definitions, MCP clients, MCP servers, workspaces, and skills as JSON files in a local directory (default: `.mastra-storage/`). Only published snapshots are written to disk — version history is kept in memory. Use with `MastraCompositeStore`'s `editor` shorthand to enable Git-friendly editor configurations.

```typescript
import { MastraCompositeStore } from '@mastra/core/storage';
import { FilesystemStore } from '@mastra/editor/storage';
import { PostgresStore } from '@mastra/pg';

export const mastra = new Mastra({
  storage: new MastraCompositeStore({
    id: 'composite',
    default: new PostgresStore({ id: 'pg', connectionString: process.env.DATABASE_URL }),
    editor: new FilesystemStore({ dir: '.mastra-storage' }),
  }),
});
```

Added `applyStoredOverrides` to the editor agent namespace. When a stored configuration exists for a code-defined agent, the editor merges the stored **instructions** and **tools** on top of the code agent's values at runtime. Model, memory, workspace, and other code-defined fields are never overridden — they may contain SDK instances or dynamic functions that cannot be safely serialized. Original code-defined values are preserved via a WeakMap and restored if the stored override is deleted.
