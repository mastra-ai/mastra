---
'@mastra/core': patch
---

Surface filesystem read failures in the workspace `grep` tool instead of silently reporting them as a complete "0 matches" search.

- **Partial-search reporting.** When a directory cannot be listed or a file cannot be read, those failures are now counted and appended to the result summary (`N paths skipped: read error`) so a partial search is distinguishable from a genuinely empty one.
- **Missing targets.** If the target path does not exist (`ENOENT`, or `ENOTDIR` when a path component is a file), the summary reports `target path not found: nothing searched` rather than a plain "0 matches".
- **Strict mode.** A new construction-time `strict` option makes any such read failure throw instead of being skipped, for callers that want to fail fast.
- **`.gitignore` handling.** `loadGitignore` now only swallows a genuinely-absent `.gitignore` (`ENOENT`) and rethrows permission/IO errors, which previously changed the search scope silently.

Enable strict mode when constructing the workspace tools to fail fast when any part of the target cannot be read:

```ts
import { createWorkspaceTools, WORKSPACE_TOOLS } from '@mastra/core/workspace';

const tools = await createWorkspaceTools(workspace, undefined, { grep: { strict: true } });
// Throws instead of reporting a partial result when a path cannot be read.
const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute({ pattern: 'needle' }, { workspace });
```
