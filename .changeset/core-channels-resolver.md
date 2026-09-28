---
'@mastra/core': minor
---

Added support for resolving channel providers dynamically. The `channels` option on the `Mastra` constructor now also accepts a resolver function, so channel connections added on the Mastra platform show up on a running server without a redeploy.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { channels } from '@mastra/connect';

export const mastra = new Mastra({
  channels: await channels({ projectId: 'my-project' }),
});
```

A resolver exposes its webhook and OAuth routes up front through `getRoutes()`, and the providers themselves are resolved at runtime. Use the new `mastra.resolveChannels()` method to get the current provider map; `getChannelProviders()` keeps returning the latest resolved snapshot. Static `channels` records keep working unchanged.
