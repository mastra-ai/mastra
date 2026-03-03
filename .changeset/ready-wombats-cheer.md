---
'@mastra/deployer-vercel': minor
---

Added `studio` option to deploy Studio alongside your API. When enabled, Studio is served as static assets from Vercel's Edge CDN while the API stays in the serverless function. No function invocations are consumed for Studio requests.

```typescript
import { VercelDeployer } from '@mastra/deployer-vercel';

new VercelDeployer({
  studio: true,
});
```
