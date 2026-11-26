---
'@mastra/connect': minor
---

Added typed payloads for Connect events, and an `events` filter on `ConnectEvents`. Pick providers and event types, and checking `provider` and `eventType` types the `payload` from the provider's published contract. Payloads are typed for Clerk, ElevenLabs, Fireflies, GitHub, GitLab, HubSpot, incident.io, Jira, Linear, Notion, OpenAI, Outlook, Resend, SendGrid, Slack, Supabase, Telegram, WorkOS and Zendesk:

```ts
import { ConnectEvents } from '@mastra/connect';

for await (const event of new ConnectEvents({ events: { github: ['pull_request.opened'], linear: true } })) {
  if (event.provider === 'github') {
    console.log(event.payload.pull_request.title);
  } else if (event.eventType === 'Issue.create') {
    console.log(event.payload.data.title);
  }
}
```

A provider with typed payloads only delivers the event types Connect has types for, and only payloads that parsed as JSON, so every event it delivers has a typed payload. Unverified events are dropped unless `includeUnverified` is set. An event with no payload is treated like one that didn't parse. To type another provider's events, extend the `ConnectEventPayloads` interface with `declare module '@mastra/connect'` and list its event types in `events`; `true` delivers all of such a provider's events, untyped. To type more events of a typed provider, extend its map, such as `SlackWebhookPayloads`, the same way, and list the new event type in `events`.

**Breaking:** `ConnectEvents` now drops unverified events unless `includeUnverified` is set, and drops event types of a typed provider that Connect has no type for unless they are listed in `events`. `ConnectEvent`'s `integrationId` field is renamed to `provider`, and the `ConnectEventIntegration` type to `ConnectEventProvider`:

```ts
// Before
await handle(event.integrationId, event.eventType, event.payload);

// After
await handle(event.provider, event.eventType, event.payload);
```

`ConnectEvent` is now a union of the typed events and `UntypedConnectEvent`, so an interface can no longer extend it. Extend `UntypedConnectEvent` instead.
