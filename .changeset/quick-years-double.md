---
'@mastra/core': minor
---

Channel conversations (Slack, Discord, Teams) now find their Mastra thread through a dedicated `mastra_channel_threads` table instead of searching every thread's metadata. Lookups stay fast as the number of threads grows, and subscribing or unsubscribing a thread flips one flag on that row instead of rewriting the thread's metadata. Existing conversations are moved to the table the next time they receive a message; nothing to migrate by hand.

Custom storage adapters can opt in by implementing the new optional `ChannelsStorage` methods (`getThreadMapping`, `getThreadMappingByThreadId`, `upsertThreadMapping`, `setThreadSubscribed`, `deleteThreadMapping`). Adapters that do not implement them keep the previous behavior.

```ts
import { ChannelsStorage } from '@mastra/core/storage';
import type { ChannelThreadKey, ChannelThreadMapping, ChannelThreadMappingInput } from '@mastra/core/storage';

class MyChannelsStorage extends ChannelsStorage {
  // ...existing installation and config methods...

  async getThreadMapping(key: ChannelThreadKey): Promise<ChannelThreadMapping | null> {
    return this.db.findOne('channel_threads', key);
  }

  async upsertThreadMapping(mapping: ChannelThreadMappingInput): Promise<ChannelThreadMapping> {
    // Insert, or on conflict update externalChannelId/subscribed only. Never change threadId.
    return this.db.upsert('channel_threads', mapping);
  }
}
```
