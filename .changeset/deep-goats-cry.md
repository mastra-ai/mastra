---
'@mastra/connect': minor
---

Added `ConnectClient` and `EventsClient` so your code can manage Mastra platform connections and react to provider events without polling.

**ConnectClient** lists the connections linked to your project, reads credentials, calls providers through the platform proxy, and starts connect and reconnect sessions. Every call has a 15-second timeout by default. Errors now say whether the platform or the provider answered (`source`), carry the platform's problem type (`problemCode`), and include `retryAfterMs` for 429 and 503 responses.

```typescript
import { ConnectClient } from '@mastra/connect';

const connect = new ConnectClient();
const [jira] = await connect.listConnections({ providerKeys: ['jira'] });
const issue = await connect.proxy(jira.id, { method: 'GET', path: '/rest/api/3/issue/ENG-1' });
```

**EventsClient** streams a project's topics from the platform events service. `connectEvents()` delivers the webhooks your connections receive, reconnects on its own, and resumes from a cursor you store, so a restart picks up where it stopped.

```typescript
for await (const event of connect.events.connectEvents({ after: savedCursor })) {
  await handle(event.integrationId, event.eventType, event.payload);
  await saveCursor(event.id);
}
```
