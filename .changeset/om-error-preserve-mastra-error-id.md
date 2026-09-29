---
'@mastra/memory': patch
---

Observational memory failure messages now include the Mastra error ID (for example `MASTRA_STORAGE_LIBSQL_UPDATE_BUFFERED_OBSERVATIONS_FAILED`), so storage failures show which operation failed instead of only the raw driver message.
