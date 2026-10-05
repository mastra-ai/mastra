---
'@mastra/loggers': patch
---

`HttpTransport` no longer buffers logs without limit while its endpoint is unavailable. The buffer is now capped by `maxBufferSize` (default 10,000 entries); when it is full, the oldest logs are dropped first. Use `getDroppedLogCount()` to see how many logs were dropped. Only one flush request is sent at a time, so an outage no longer triggers a new failing request for every log written.

```ts
import { HttpTransport } from '@mastra/loggers/http';

const transport = new HttpTransport({
  url: 'https://logs.example.com/ingest',
  maxBufferSize: 5_000,
});

transport.getDroppedLogCount(); // number of logs dropped during outages
```
