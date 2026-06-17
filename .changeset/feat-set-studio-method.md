---
"@mastra/core": minor
---

Add `setStudio()` method to Mastra class for runtime studio configuration.

This enables deploy wrappers to configure studio auth/RBAC separately from server config, which is required for dual auth patterns where Studio UI uses platform auth while Server API remains open or uses user-configured auth.

```typescript
// Set studio auth separately from server auth
mastra.setStudio({
  auth: new MastraAuthStudio(),
  rbac: new MastraRBACStudio({ roleMapping: { admin: ['*'] } }),
});
```
