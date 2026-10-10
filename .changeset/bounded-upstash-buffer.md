---
'@mastra/loggers': patch
---

`UpstashTransport` now keeps a limited number of records in memory while Upstash is unreachable, instead of growing without limit.

- The new `maxBufferSize` option limits how many unsent records are kept in memory. It must be a positive integer. It defaults to `maxListLength`, or 10000 when `maxListLength` turns off trimming.
- When the buffer is full, the oldest records are dropped. The new `droppedRecords` field counts them.
- Only one request is sent to Upstash at a time, so many writes during an outage no longer open hundreds of requests.

```ts
const transport = new UpstashTransport({
  upstashUrl: process.env.UPSTASH_URL!,
  upstashToken: process.env.UPSTASH_TOKEN!,
  maxBufferSize: 5000,
});

console.log(transport.droppedRecords);
```
