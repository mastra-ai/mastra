---
'@mastra/core': patch
---

HTTP request logging can now be configured in detail via `apiReqLogs` in the server config. The new `HttpLoggingConfig` type is exported from `@mastra/core/server`.

```ts
import type { HttpLoggingConfig } from '@mastra/core/server';

const loggingConfig: HttpLoggingConfig = {
  enabled: true,
  level: 'info',
  excludePaths: ['/health', '/metrics'],
  includeHeaders: true,
  includeQueryParams: true,
  redactHeaders: ['authorization', 'cookie'],
};
```
