---
'@mastra/platform-workspace': patch
'@mastra/factory': patch
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows.

```typescript
import { PlatformSandbox } from '@mastra/platform-workspace';

const sandbox = new PlatformSandbox({
  environmentId: 'env_abc',
  actingUserId: auth.user.id,
});
```
