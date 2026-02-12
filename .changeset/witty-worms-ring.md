---
'@mastra/core': minor
---

Added `mastra_workspace_grep` workspace tool for regex-based content search across files. This complements the existing semantic search tool by providing direct pattern matching with support for case-insensitive search, file filtering by extension, context lines, and result limiting.

The tool is automatically available when a workspace has a filesystem configured:

```typescript
import { Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { LocalFilesystem } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './my-project' }),
});

// The grep tool is auto-injected and available as:
// WORKSPACE_TOOLS.SEARCH.GREP → 'mastra_workspace_grep'
```
