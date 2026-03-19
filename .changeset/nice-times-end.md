---
'@mastra/server': minor
---

Added `getAuthenticatedUser()` to `@mastra/server/auth` so server middleware can resolve the configured auth user without changing route auth behavior.

**Example**

```ts
import { getAuthenticatedUser } from '@mastra/server/auth'

const user = await getAuthenticatedUser({
  mastra,
  authToken,
  request: c.req.raw,
})
```
