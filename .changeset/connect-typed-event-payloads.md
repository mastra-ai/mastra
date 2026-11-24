---
'@mastra/connect': minor
---

Added typed payloads for Connect events. `isConnectEvent()` narrows an event from `ConnectEvents` to one integration's event types, and types its `payload` from the provider's published contract, for GitHub, Linear, GitLab, Jira and incident.io:

```ts
import { ConnectEvents, isConnectEvent } from '@mastra/connect';

for await (const event of new ConnectEvents()) {
  if (isConnectEvent(event, 'github', 'pull_request.opened')) {
    console.log(event.payload.pull_request.title);
  }
}
```

Unverified events and payloads that weren't JSON never match. To type another integration's events, extend the `ConnectEventPayloads` interface with `declare module '@mastra/connect'`.

**Breaking (prerelease only):** `ConnectEvent` is now a union of the typed events and `UntypedConnectEvent`, so an interface can no longer extend it. Extend `UntypedConnectEvent` instead.
