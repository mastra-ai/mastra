---
'@mastra/blaxel': minor
---

Added provider-specific `blaxel` getter to access the underlying Blaxel `SandboxInstance` directly. Deprecated the generic `instance` getter in favor of the new `blaxel` getter for better IDE discoverability and consistency with other sandbox providers.

```typescript
// Before
const blaxelSandbox = sandbox.instance;

// After
const blaxelSandbox = sandbox.blaxel;
```
