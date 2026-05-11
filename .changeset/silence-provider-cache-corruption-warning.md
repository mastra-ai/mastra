---
'@mastra/core': patch
---

Stop logging auto-recoverable provider cache corruption warnings when `~/.cache/mastra/` contains stale content from another Mastra version. Corrupted cache files are still deleted on read so they cannot propagate into a project's `dist/`, and the next gateway sync rewrites valid files.
