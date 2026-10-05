---
'@mastra/core': minor
---

Channel conversations (Slack, Discord, Teams) now find their Mastra thread through a dedicated `mastra_channel_threads` table instead of searching every thread's metadata. Lookups stay fast as the number of threads grows, and subscribing or unsubscribing a thread flips one flag on that row instead of rewriting the thread's metadata. Existing conversations are moved to the table the next time they receive a message; nothing to migrate by hand.

Custom storage adapters opt in by implementing all five new optional `ChannelsStorage` methods. The optimized path is used only when every one of them is present; adapters that implement none keep the previous behavior.

```ts
import { ChannelsStorage } from '@mastra/core/storage';
import type { ChannelThreadKey, ChannelThreadMapping, ChannelThreadMappingInput } from '@mastra/core/storage';

class MyChannelsStorage extends ChannelsStorage {
  // ...existing installation and config methods...

  async getThreadMapping(key: ChannelThreadKey): Promise<ChannelThreadMapping | null> { /* ... */ }
  async getThreadMappingByThreadId(threadId: string): Promise<ChannelThreadMapping | null> { /* ... */ }
  // Insert, or on conflict update externalChannelId and subscribed only. Never change threadId.
  async upsertThreadMapping(mapping: ChannelThreadMappingInput): Promise<ChannelThreadMapping> { /* ... */ }
  async setThreadSubscribed(key: ChannelThreadKey, subscribed: boolean): Promise<void> { /* ... */ }
  async deleteThreadMapping(key: ChannelThreadKey): Promise<void> { /* ... */ }
}
```
