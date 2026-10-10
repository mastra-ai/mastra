---
'@mastra/loggers': patch
---

Fixed `UpstashTransport` using unbounded memory during an Upstash outage. Records that cannot be sent are now held in a buffer capped by the new `maxBufferSize` option (defaults to `maxListLength`); once it is full, the oldest records are dropped and counted in `droppedRecords`. Only one request to Upstash is in flight at a time, so a burst of writes during an outage no longer opens hundreds of concurrent requests.

```ts
const transport = new UpstashTransport({
  upstashUrl: process.env.UPSTASH_URL!,
  upstashToken: process.env.UPSTASH_TOKEN!,
  maxBufferSize: 5000,
});

console.log(transport.droppedRecords);
```
