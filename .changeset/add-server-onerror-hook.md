---
'@mastra/core': minor
'@mastra/deployer': minor
---

Add `onError` hook to server configuration for custom error handling.

You can now provide a custom error handler through the Mastra server config to catch errors, format responses, or send them to external services like Sentry:

```typescript
import { Mastra } from '@mastra/core/mastra';

const mastra = new Mastra({
  server: {
    onError: (err, c) => {
      // Send to Sentry
      Sentry.captureException(err);

      // Return custom formatted response
      return c.json({
        error: err.message,
        timestamp: new Date().toISOString(),
      }, 500);
    },
  },
});
```

If no `onError` is provided, the default error handler is used.

Fixes #9610
