---
'@mastra/connect': minor
---

Added typed payloads for Connect events. `isConnectEvent()` narrows an event from `ConnectEvents` to one provider's event types, and types its `payload` from the provider's published contract. Payloads are typed for Clerk, ElevenLabs, Fireflies, GitHub, GitLab, HubSpot, incident.io, Jira, Linear, Notion, OpenAI, Outlook, Resend, SendGrid, Slack, Supabase, Telegram, WorkOS and Zendesk:

```ts
import { ConnectEvents, isConnectEvent } from '@mastra/connect';

for await (const event of new ConnectEvents()) {
  if (isConnectEvent(event, 'github', 'pull_request.opened')) {
    console.log(event.payload.pull_request.title);
  }
}
```

Unverified events and payloads that weren't JSON never match. To type another provider's events, extend the `ConnectEventPayloads` interface with `declare module '@mastra/connect'`. To type more events of a typed provider, extend its map, such as `SlackWebhookPayloads`, the same way.

**Breaking:** `ConnectEvent`'s `integrationId` field is renamed to `provider`, and the `ConnectEventIntegration` type to `ConnectEventProvider`:

```ts
// Before
await handle(event.integrationId, event.eventType, event.payload);

// After
await handle(event.provider, event.eventType, event.payload);
```

`ConnectEvent` is now a union of the typed events and `UntypedConnectEvent`, so an interface can no longer extend it. Extend `UntypedConnectEvent` instead.
