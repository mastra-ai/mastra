---
'@mastra/client-js': patch
---

Fix `listLogs` and `getLogForRun` dropping the `page` and `perPage` query parameters when they are `0`. Requesting the first page with `page: 0` (or `perPage: 0`) now sends those values instead of falling back to the server defaults. Closes #18631.
