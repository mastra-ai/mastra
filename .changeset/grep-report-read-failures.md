---
'@mastra/core': patch
---

Fix the workspace `grep` tool silently reporting a partial or failed search as a complete "0 matches" success. When the target path cannot be resolved, a directory cannot be listed, or a file cannot be read, the tool now records those failures and appends them to the result summary (`target path not found: nothing searched` for a genuinely missing target, `N paths skipped: read error` for permission/IO failures) so a partial search is distinguishable from an empty one. A new `strict` input option throws on any such read failure instead of skipping it. `loadGitignore` now only swallows a genuinely-absent `.gitignore` (ENOENT) and rethrows permission/IO errors, which previously changed the search scope silently.

Enable strict mode to fail fast when any part of the target cannot be read:

```ts
import { WORKSPACE_TOOLS } from '@mastra/core/workspace';

const tools = await createWorkspaceTools(workspace);
// Throws instead of reporting a partial result when a path cannot be read.
const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle', strict: true }, { workspace });
```
