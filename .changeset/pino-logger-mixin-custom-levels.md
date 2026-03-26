---
'@mastra/loggers': minor
---

**PinoLogger enrichment**

Adds optional `mixin` and `customLevels` options to `PinoLogger`, to attach shared fields (such as trace IDs), supporting existing Pino setups.

https://github.com/mastra-ai/mastra/issues/14630

```typescript
import { PinoLogger } from '@mastra/loggers'

const withMixin = new PinoLogger({
  name: 'Mastra',
  level: 'info',
  mixin() {
    return { traceId: 'abc-123' }
  },
})

withMixin.info('hello')

type AuditLevel = 'audit'

class LoggerWithAudit extends PinoLogger<AuditLevel> {
  audit(message: string, meta: Record<string, unknown> = {}) {
    this.logger.audit(meta, message)
  }
}

const withCustomLevels = new LoggerWithAudit({
  name: 'Mastra',
  level: 'info',
  customLevels: { audit: 35 },
})

withCustomLevels.audit('access granted', { resource: '/admin' })
```
