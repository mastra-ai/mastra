---
'@mastra/observability': minor
---

Added Platform context resolution for feedback and score events without supplied correlation context. MastraPlatformExporter sends these records individually, retries temporary anchor lookup failures, and drains pending deliveries during flush and shutdown. Records with supplied context retain collector batching.


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
