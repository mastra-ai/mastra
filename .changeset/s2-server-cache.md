---
'@mastra/s2': minor
---

Add `@mastra/s2`, a durable `PubSub` backed by [S2](https://s2.dev) for durable agents. Each durable-agent topic maps to an S2 stream, and an event's index is the sequence number assigned by s2 on append.

```ts
import { Mastra } from '@mastra/core/mastra';
import { S2PubSub } from '@mastra/s2';

export const mastra = new Mastra({
  agents: { durableAgent },
  pubsub: new S2PubSub({
    accessToken: process.env.S2_ACCESS_TOKEN!,
    basin: process.env.S2_BASIN!,
  }),
});
```
