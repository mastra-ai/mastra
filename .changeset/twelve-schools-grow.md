---
'mastra': minor
---

Added a `--server-api-prefix` flag to `mastra api` so the CLI can reach a Mastra server mounted under a custom API route prefix. Previously `mastra api` always targeted `<url>/api/<route>`, so it could not talk to servers mounted under a non-default prefix (for example a `@mastra/fastify` `MastraServer` with `prefix: "/api/mastra-studio"`). This matches the `--server-api-prefix` flag that `mastra studio` already supports.

The prefix can also be set with the `MASTRA_API_PREFIX` environment variable.

**Before** (the prefix could not be placed between the host and the route):

```bash
# → GET https://example.com/api/agents → 404
mastra api --url https://example.com agent list
```

**After**:

```bash
# → GET https://example.com/api/mastra-studio/agents
mastra api --url https://example.com --server-api-prefix /api/mastra-studio agent list
```
