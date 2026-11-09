---
'@mastra/server': patch
---

Fixed server routes that broke when an application resolves `zod` to v3:

- `GET /api/background-tasks` no longer fails with `keyValidator._parse is not a function`.
- The `POST /api/v1/conversations` and `GET /api/v1/conversations/:conversationId` response contracts in `GET /api/system/api-schema` and the OpenAPI document now include the `thread` property again.

All server schemas now import `zod/v4` explicitly instead of mixing `zod` and `zod/v4` schemas in the same object.
