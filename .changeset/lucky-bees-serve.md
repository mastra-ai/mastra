---
'@mastra/core': patch
---

Fixed workspace search index names to be compatible with SQL-based vector stores (PgVector, LibSQL). Index names now use underscores instead of hyphens, matching SQL identifier requirements.

Added `searchIndexName` option to Workspace config for custom index names when needed.

Fixes #12656
