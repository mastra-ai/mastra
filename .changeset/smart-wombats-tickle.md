---
'@mastra/core': patch
---

Fixed excessive memory use when evented workflows finish by removing unused ancestor execution data from completion events and limiting queued Unix-socket publisher writes.

Configure the publisher queue limit with `maxPublisherQueuedBytes` (defaults to 64 MiB). Publishes that exceed the available capacity reject rather than adding more buffered writes:

```ts
import { UnixSocketPubSub } from '@mastra/core/events';

const pubsub = new UnixSocketPubSub('/tmp/workflows.sock', {
  maxPublisherQueuedBytes: 8 * 1024 * 1024,
});
```
