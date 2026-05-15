---
'@mastra/server': minor
---

Added automatic FGA metadata for stored resource routes plus optional request scope isolation for stored resource APIs. Enable protected-route coverage with provider options:

```ts
const fga = new MastraFGAWorkos({
  resourceMapping,
  permissionMapping,
  requireForProtectedRoutes: true,
  auditProtectedRoutes: 'warn',
});
```
