---
'@mastra/loggers': patch
---

Fixed Upstash logger memory growth during service outages. Use `maxBufferSize` to limit queued logs (10,000 by default); the oldest logs are dropped when the buffer is full, and `getDroppedLogCount()` returns the total number dropped.

```ts
import { UpstashTransport } from '@mastra/loggers/upstash';

const transport = new UpstashTransport({
  upstashUrl: process.env.UPSTASH_URL!,
  upstashToken: process.env.UPSTASH_TOKEN!,
  maxBufferSize: 1_000,
});

const droppedLogs = transport.getDroppedLogCount();
```
