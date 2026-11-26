---
'@mastra/auth-studio': patch
---

Added `pinnedOrganizationId` to `MastraAuthStudio`: the organization the deployment is pinned to, if any. Routes that check their own tokens can use it to refuse other organizations.

```ts
// `auth` is the deployment's configured MastraAuthStudio instance.
if (auth.pinnedOrganizationId && orgId !== auth.pinnedOrganizationId) return forbidden();
```
