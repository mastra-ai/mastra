---
'mastra': minor
---

Added `--permission` to `mastra auth tokens create`, so an organization admin can create a token that creates and deletes databases:

```bash
mastra auth tokens create ci --permission databases:write
```

If the platform creates the token without a requested permission, the command revokes that token and fails, so no token with less access than asked for is left behind. `mastra auth tokens` now lists each token's permissions.
