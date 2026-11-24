---
'@mastra/connect': minor
---

Added `ConnectEvents`, a single class for receiving a project's provider events. It takes the client configuration and where to start in one options object, and you iterate it directly:

```ts
import { ConnectEvents } from '@mastra/connect';

const events = new ConnectEvents({
  cursorStore: { load: () => db.get('events-cursor'), save: cursor => db.set('events-cursor', cursor) },
  onGap: () => resyncFromProviders(),
});

for await (const event of events) {
  await handle(event.integrationId, event.eventType, event.payload);
}
```

**Breaking (prerelease only):** `EventsClient`, `EventSubscription`, `connectEvents()`, `ConnectClient.events`, the `eventsUrl` option on `ConnectClient`, and the `EventsClientOptions`, `SubscribeOptions` and `TopicEvent` types are no longer exported. Pass `eventsUrl` to `ConnectEvents` instead.
