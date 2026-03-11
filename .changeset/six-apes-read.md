---
'@mastra/daytona': minor
---

Added provider-specific `daytona` getter to access the underlying Daytona `Sandbox` instance directly. Deprecated the generic `instance` getter in favor of the new `daytona` getter for better IDE discoverability and consistency with other sandbox providers.

```typescript
// Before
const daytonaSandbox = sandbox.instance;

// After
const daytonaSandbox = sandbox.daytona;
```
