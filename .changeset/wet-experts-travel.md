---
'@mastra/platform-workspace': major
---

Removed support for using `MASTRA_PLATFORM_SECRET_KEY` to authenticate workspace providers. Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN` or pass `accessToken` explicitly instead.

**Before:** Set `MASTRA_PLATFORM_SECRET_KEY`.

**After:** Use the platform-injected `MASTRA_PLATFORM_ACCESS_TOKEN`. For local development, set `MASTRA_PLATFORM_ACCESS_TOKEN` to an organization API token, or pass it explicitly:

```typescript
import { PlatformSandbox } from '@mastra/platform-workspace';

const sandbox = new PlatformSandbox({
  accessToken: 'sk_your-api-token',
  projectId: 'project_abc',
  environmentId: 'environment_abc',
});
```
