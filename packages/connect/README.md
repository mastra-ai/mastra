# Platform connection tools

`@mastra/connect` exposes tools backed by connections attached to a Mastra Platform project. Provider credentials stay in the platform connection. Tool traffic passes through Platform so calls can be authorized, audited, and counted without logging arguments or results.

## Resend and incident.io

Attach a connection to your project using integration ID `resend` or `incident-io`. Configure the Platform project ID and access token, then pass the resolver to your agent's `tools` option:

```ts
import { connect } from '@mastra/connect';

const tools = connect({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  integrations: {
    resend: { allowTools: ['resend_send_email', 'resend_get_email'] },
    'incident-io': { allowTools: ['incident_io_list_incidents', 'incident_io_list_follow_ups'] },
  },
});
```

The resolver discovers active project connections. Where multiple connections match, select one with `MASTRA_RESEND_CONNECTION_ID`, `MASTRA_INCIDENT_IO_CONNECTION_ID`, or the integration's `connectionId` option. The `integrations` entries configure individual providers; they do not disable other attached providers. Set `disabled: true` on providers you want to exclude.

| Provider    | Tool source          | Scope                                                                                                                                                     |
| ----------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resend      | Generated HTTP tools | Emails and attachments, domains, templates, audiences, contacts, segments, topics, broadcasts, webhooks, and metrics                                      |
| incident.io | Generated HTTP tools | Incidents, updates, actions, follow-ups, timelines, alerts, on-call schedules, teams, users, postmortems, catalog reads, and incident configuration reads |

## Generated HTTP providers

Resend and incident.io use checked-in tools generated from their provider contracts. Tool inputs preserve provider field names. Mutations put their JSON request payload under `body`.

```json
{
  "idempotency_key": "welcome-user-123",
  "body": {
    "from": "Team <team@example.com>",
    "to": ["reader@example.com"],
    "subject": "Welcome",
    "text": "Thanks for joining."
  }
}
```

Resend requires a verified sending domain and a key authorized for the operation. A sending-only key cannot list domains or access other account resources. Reuse the idempotency key when retrying the same send. Mastra's proxy runtime does not automatically retry POST requests.

List tools return one provider page and preserve its response envelope. When `next_cursor` is present, pass it as `after` for Resend and incident.io. Preserve filters and sort options between pages.

## Template provenance

Resend and incident.io are generated from integration-template contributions [#667](https://github.com/NangoHQ/integration-templates/pull/667) and [#668](https://github.com/NangoHQ/integration-templates/pull/668). Until they land upstream, each provider manifest pins the contributing repository and exact commit and records generated file checksums.

See [maintainer generation commands](./scripts/README.md) and [third-party notices](./NOTICE.md). Generated-provider tests use OpenAPI examples and synthetic fixtures.
