---
'@mastra/factory': minor
---

Work item comment feeds now update live instead of on a five-second poll: while a browser holds its feed stream, a new comment shows up the moment it lands, and a browser whose stream dropped falls back to the old poll until it reconnects.

Delivery rides the factory's `pubsub`, so reaching browsers across replicas takes a shared broker — the in-process default only serves readers held by the replica that took the write:

```ts
import { MastraFactory } from '@mastra/factory';
import { RedisStreamsPubSub } from '@mastra/redis-streams';

export const factory = new MastraFactory({
  pubsub: new RedisStreamsPubSub({ url: process.env.REDIS_URL }),
});
```
