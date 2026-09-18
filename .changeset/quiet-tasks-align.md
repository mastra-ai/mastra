---
'@mastra/server': patch
---

Fix `GET /background-tasks` failing with `keyValidator._parse is not a function` when the application resolves bare `zod` to v3. The background-tasks query schema was built with `zod` while composing `paginationNumber()` from `zod/v4`, mixing schema instances inside one object. The schema now uses `zod/v4` like the rest of the server schemas.
