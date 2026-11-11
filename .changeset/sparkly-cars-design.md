---
'@mastra/observability': minor
---

Added support for exporting feedback and scores that need trace details from Platform. The exporter retries while waiting for a trace to arrive, and `flush()` and `shutdown()` wait for pending deliveries to finish.

```typescript
import { MastraPlatformExporter } from '@mastra/observability';

const exporter = new MastraPlatformExporter();
await exporter.onFeedbackEvent({
  type: 'feedback',
  feedback: {
    feedbackId: crypto.randomUUID(),
    timestamp: new Date(),
    traceId: 'existing-trace-id',
    feedbackType: 'comment',
    feedbackSource: 'user',
    value: 'actionable',
  },
});
await exporter.flush();
```
