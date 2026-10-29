---
'@mastra/server': minor
---

The auth middleware now stores the authenticated user on the request context, normalized to the `MastraUser` shape by the auth provider's `toMastraUser()`. When an RBAC provider is configured and the provider's user has no role, the primary RBAC role is used.

```ts
import { MASTRA_NORMALIZED_USER_KEY } from '@mastra/core/request-context';

const user = requestContext.get(MASTRA_NORMALIZED_USER_KEY);
// { id: 'user-123', name: 'Ada', email: 'ada@example.com', role: 'admin' }
```

`@mastra/server` now requires `@mastra/core` 1.81.0 or later.
