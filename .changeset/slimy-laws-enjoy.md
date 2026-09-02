---
'@mastra/core': patch
---

Fixed UnixSocketPubSub accepting unbounded inbound frames. Added a `maxInboundFrameBytes` option (default 64 MiB); a connection that sends a larger frame, or an unterminated partial frame beyond that size, is disconnected, and partial frames are buffered compactly regardless of how they are fragmented, so a single peer can no longer exhaust broker memory. Fixes #22376

```ts
import { UnixSocketPubSub } from '@mastra/core/events';

const pubsub = new UnixSocketPubSub('/tmp/mastra.sock', {
  maxInboundFrameBytes: 8 * 1024 * 1024, // 8 MiB
});
```
