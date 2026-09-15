---
'@mastra/core': patch
---

Fix the workspace `grep` tool silently reporting a partial or failed search as a complete "0 matches" success. When the target path cannot be resolved, a directory cannot be listed, or a file cannot be read, the tool now records those failures and appends them to the result summary (`target path not found: nothing searched` / `N paths skipped: read error`) so a partial search is distinguishable from an empty one. A new `strict` input option throws on any such read failure instead of skipping it. `loadGitignore` now only swallows a genuinely-absent `.gitignore` (ENOENT) and rethrows permission/IO errors, which previously changed the search scope silently.
