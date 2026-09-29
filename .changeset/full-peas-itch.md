---
'@mastra/code-sdk': patch
'mastracode': patch
---

Added `mastracode prune`, which cleans up the local database from the shell instead of from inside the interactive session.

It deletes data older than the retention policies, and `--vacuum` returns the freed space to the operating system for a local libsql database (remote libsql and Postgres only delete rows). `--keep-memory` keeps chat history. This works even when the interactive session will not start, which previously left a large database with no way to reclaim it from inside the tool.

```bash
mastracode prune                 # delete rows past the retention policies
mastracode prune --vacuum        # ...then compact the files to reclaim disk
mastracode prune --keep-memory   # ...but keep chat history
```

`mastracode prune` and `/prune` refuse to run while another session is open, and a session started during either waits for it to finish. The lock lives in the app data directory, so sessions sharing one `MASTRA_DB_PATH` with different `MASTRA_APP_DATA_DIR` values don't see each other.

Part of #22056.
