---
'@mastra/core': minor
'@mastra/server': patch
---

Added an opt-in `mastra_workspace_apply_patch` workspace tool so agents can create, update, move, and delete several files in one call. It stays off until you enable it; a top-level `tools.enabled: true` does not turn it on. Existing agents keep `write_file` and `edit_file`.

```ts
import { Workspace, LocalFilesystem, WORKSPACE_TOOLS } from '@mastra/core/workspace'

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH]: { enabled: true },
  },
})
```
