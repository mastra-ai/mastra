---
'@mastra/factory': minor
---

Work item comment feeds now update live instead of on a five-second poll: a comment written on one replica reaches every open browser, and the client falls back to polling only while its stream is down.

Delivery rides the factory's `pubsub`. The in-process default only reaches readers held by the replica that took the write, so a multi-replica deployment passes a shared broker:

```ts
import { MastraFactory } from '@mastra/factory';
import { RedisStreamsPubSub } from '@mastra/redis-streams';

export const factory = new MastraFactory({
  pubsub: new RedisStreamsPubSub({ url: process.env.REDIS_URL }),
});
```
