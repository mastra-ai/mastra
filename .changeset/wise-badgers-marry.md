---
'@mastra/core': patch
---

Improved workspace `grep` and `list_files` tool performance on remote filesystems. The `list_files` tree walk now issues directory listings concurrently instead of one at a time, and `WorkspaceFilesystem` providers can implement optional `walk()` and `grep()` methods to run tree walks and content searches natively in a single call. The workspace tools use these capabilities automatically when available and fall back to the existing host-side walk otherwise, so a grep over a remote sandbox filesystem no longer needs one network round trip per directory and file. When a native capability fails and the tools fall back to the host-side walk, the downgrade is logged through the workspace logger (`info` for an unsupported grep pattern, `warn` for any other failure) so unexpected per-file round trips are visible. `Workspace` now exposes a read-only `logger` getter. Fixes https://github.com/mastra-ai/mastra/issues/22285

```ts
import { UnsupportedGrepPatternError } from '@mastra/core/workspace';
import type { WorkspaceFilesystem, WalkEntry, FilesystemGrepResult } from '@mastra/core/workspace';

class RemoteFilesystem implements WorkspaceFilesystem {
  // ...required methods...

  // Optional: return every entry under `path` in one call.
  async walk(path: string, options?: { maxDepth?: number; includeHidden?: boolean }): Promise<WalkEntry[]> {
    return this.api.listTree(path, options);
  }

  // Optional: run the search remotely. `column` must be a UTF-16 index.
  // Throw UnsupportedGrepPatternError to let the tool fall back to the host walk.
  async grep(options: { pattern: string; path: string; caseSensitive: boolean }): Promise<FilesystemGrepResult[]> {
    if (!this.api.supportsRegex(options.pattern)) throw new UnsupportedGrepPatternError(options.pattern);
    return this.api.search(options);
  }
}
```
