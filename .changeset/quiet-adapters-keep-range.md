---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/clickhouse': patch
---

Storage adapters keep their existing `@mastra/core` peer range while supporting Knowledge. With an older `@mastra/core`, adapters still load, and Knowledge storage fails with a clear error that names the required core feature instead of breaking at import time.
