---
'@mastra/code-sdk': patch
'mastracode': patch
---

Added `mastracode prune`, which cleans up the local database from the shell instead of from inside the interactive session.

It deletes data older than the retention policies, and `--vacuum` returns the freed space to the operating system. `--keep-memory` keeps chat history. This works even when the interactive session will not start, which previously left a large database with no way to reclaim it from inside the tool.

```bash
mastracode prune                 # delete rows past the retention policies
mastracode prune --vacuum        # ...then compact the files to reclaim disk
mastracode prune --keep-memory   # ...but keep chat history
```

Fixes #22056.
