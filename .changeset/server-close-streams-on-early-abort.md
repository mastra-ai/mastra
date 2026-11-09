---
'@mastra/server': minor
---

Added `cancelReaderOnResponseClose` and `writeWithBackpressure` to `@mastra/server/server-adapter` for custom adapters that write streams to a Node.js response. They stop reading a route's stream when the client disconnects, including a client that leaves before the route handler returns, and wait for a slow client instead of buffering the whole stream.

```ts
import { cancelReaderOnResponseClose, writeWithBackpressure } from '@mastra/server/server-adapter';

const reader = stream.getReader();
const readerCancel = cancelReaderOnResponseClose(reader, res);
try {
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    await writeWithBackpressure(res, next.value);
  }
} finally {
  readerCancel.dispose();
  res.end();
}
```

Fixed the agent controller session stream and the background task stream staying open forever when the client disconnected before the stream started.
