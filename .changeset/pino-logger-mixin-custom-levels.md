---
'@mastra/loggers': minor
---

Added `mixin` and `customLevels` options to `PinoLogger`.

You can now attach shared fields to every log entry with `mixin`, which is useful for values like trace IDs, request IDs, or service metadata.

You can also define custom log levels when you need to match an existing Pino logging setup.

**Example**

```ts
import { PinoLogger } from '@mastra/loggers';

const logger = new PinoLogger({
  name: 'Mastra',
  level: 'info',
  mixin() {
    return { traceId: 'abc-123' };
  },
  customLevels: {
    audit: 35,
  },
});

logger.info('User signed in');`
