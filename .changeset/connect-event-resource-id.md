---
'@mastra/connect': minor
---

Connect events from a connection that belongs to an end user now carry the connection's `resourceId`, so a handler can call the provider back as that user. `ConnectEventSignals` adds it to the default notification's metadata, so a `target` can route the event to that user's thread:

```ts
import { ConnectClient, ConnectEvents } from '@mastra/connect';

const connect = new ConnectClient();

for await (const event of new ConnectEvents()) {
  const client = event.resourceId ? connect.withResource(event.resourceId) : connect;
  await client.proxy(event.connectionId, { method: 'GET', path: '/user' });
}
```

Events from project-wide connections have no `resourceId`.
