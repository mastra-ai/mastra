---
'@mastra/client-js': patch
---

Advanced trace-query request types now list `durationMs` as an `orderBy` field. Servers reject duration ordering with a structured error until the server-side capability gate ships in a following release.
