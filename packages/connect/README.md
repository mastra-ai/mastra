# @mastra/connect

`@mastra/connect` turns Mastra Platform project connections into two things an agent app needs: tools that call third-party APIs on the user's behalf (`tools()`), and channel providers that wire the agent into Slack, Telegram, or Discord (`channels()`). Provider credentials stay in the platform connection. Tool traffic passes through Platform so calls can be authorized, audited, and counted without logging arguments or results.

## Installation

```bash
npm install @mastra/connect
```

## Usage

Attach one or more integration connections to your Platform project — see the [Generated HTTP providers](#generated-http-providers) table below for the full launch set. Configure the Platform project ID and access token, then pass the resolver to your agent's `tools` option:

```ts
import { tools } from '@mastra/connect';

const agentTools = tools({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  integrations: {
    resend: { allowTools: ['resend_send_email', 'resend_get_email'] },
    'incident-io': { allowTools: ['incident_io_list_incidents', 'incident_io_list_follow_ups'] },
  },
});
```

> `tools()` used to be exported as `connect()`. The old name still works as a deprecated alias for one release cycle so existing code keeps building; migrate at your convenience. The `PROVIDERS` array is renamed to `TOOLS` under the same rule.

The resolver discovers active project connections. Where multiple connections match, select one with `MASTRA_RESEND_CONNECTION_ID`, `MASTRA_INCIDENT_IO_CONNECTION_ID`, or the integration's `connectionId` option. The `integrations` entries configure individual providers; they do not disable other attached providers. Set `disabled: true` on providers you want to exclude.

| Provider    | Tool source          | Scope                                                                                                                                                     |
| ----------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resend      | Generated HTTP tools | Emails and attachments, domains, templates, audiences, contacts, segments, topics, broadcasts, webhooks, and metrics                                      |
| incident.io | Generated HTTP tools | Incidents, updates, actions, follow-ups, timelines, alerts, on-call schedules, teams, users, postmortems, catalog reads, and incident configuration reads |

### MCP integrations

`tools()` also discovers any attached integration that advertises `capabilities.mcp: true` in the Platform catalog. No provider-specific registration or release of `@mastra/connect` is required. Discovered tools use the same flat dynamic-tool contract and are namespaced as `<integration-id>_<tool-name>`.

Every MCP provider uses `/v2/connections/:connectionId/mcp` for discovery and invocation. The adapter reuses each provider's MCP session across refreshes and closes sessions when the connection changes, is detached, or `disconnect()` is called. If an integration has both checked-in HTTP tools and an MCP capability, the MCP catalog is preferred.

The application sends only its Mastra Platform token. The transport is locked to the selected Platform connection URL. Platform removes caller authentication before Nango injects the provider credential and proxies each protocol request to the MCP server configured for that Nango integration.

MCP tool catalogs can change independently of this package. Use `allowTools` to give an agent the smallest useful subset. Every discovered MCP tool requires tool approval; the server's annotations are advisory and cannot lift the requirement. List the tool keys an agent may run unattended in `autoApproveTools` for that integration, for example `neon: { autoApproveTools: ['neon_list_projects'] }`. For multiple connections, the derived environment variable is `MASTRA_<INTEGRATION_ID>_CONNECTION_ID`, with punctuation converted to underscores.

### Generated HTTP providers

Resend, incident.io, Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot use checked-in tools generated from their provider contracts. Tool inputs preserve provider field names. Mutations put their JSON request payload under `body`. The one exception is `resend_create_contact_import`, whose `body` fields are sent as a multipart form upload with the CSV text in `body.file`.

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

### Channels

`channels()` resolves the project's connections into `Record<string, ChannelProvider>` — the exact shape `new Mastra({ channels })` already accepts. Each launch provider (Slack, Telegram, Discord) with an active project connection becomes a live agent surface with no hardcoded tokens or manual provider wiring:

```ts
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { tools, channels } from '@mastra/connect';

const pat = new Agent({
  id: 'pat',
  name: 'Pat',
  instructions: 'You are Pat.',
  model: openai('gpt-4o'),
  tools: tools({ projectId: process.env.MASTRA_PROJECT_ID }),
});

export const mastra = new Mastra({
  agents: { pat },
  channels: await channels({ projectId: process.env.MASTRA_PROJECT_ID }),
});
```

Install the peer package for each channel you attach:

```bash
npm install @mastra/slack     # for the `slack` channel
npm install @mastra/telegram  # for the `telegram` channel
npm install @mastra/discord   # for the `discord` channel
```

They're declared as optional `peerDependencies` and imported inside `channels()` via `await import()`, so nothing extra ships to consumers that don't attach a channel. A missing peer at resolution time is downgraded to a warning and that provider is skipped; the rest of the map keeps working.

#### Return shape and lifecycle

`channels()` returns a thenable resolver — `await channels({...})` yields the map directly, ready to hand to `new Mastra({ channels })`. It's also callable (`channels()({ requestContext })`) and exposes `.invalidate()` / `.refresh()` / `.disconnect()` handles for standalone/test usage.

`Mastra` reads the `Record<string, ChannelProvider>` **synchronously** at construction — top-level `await` on `channels(...)` is required, and the running Mastra instance won't pick up connections added later or rotated credentials without a restart. The `.invalidate()` / `.refresh()` handles only touch the resolver's private cache; they're for tests and long-lived resolver usage outside a Mastra registration, not for the running agent.

`channels()` shares the `projectId` / `client` / `ttlMs` shape with `tools()` and `environment()`. Per-integration overrides work the same way — pin a specific connection with `connectionId`, exclude a provider with `disabled: true`, and pass provider-specific settings through `providerOptions`:

```ts
channels: await channels({
  projectId,
  integrations: {
    slack: { connectionId: 'c_slack_ws1' },
    telegram: { providerOptions: { mode: 'webhook', typingStatus: true } },
    discord: { disabled: true },
  },
}),
```

#### Connection selection

For each channel-capable integration, `channels()` picks a single active project connection:

- A pinned `connectionId` on the integration wins, but is skipped with a warning if it isn't attached to the project, is `needs_reauth`, or isn't `active`.
- Otherwise, the single active connection is used.
- When more than one active connection exists and no pin is set, the resolver **warns and uses the first active connection**, naming the chosen id and every id it's ignoring. There is no `MASTRA_*_CONNECTION_ID` env-var fallback for channels — pin explicitly to silence the warning and make the choice deterministic.
- No attached connections, or only inactive / `needs_reauth` connections, warns and skips the provider (its key is omitted from the map).

Configuration errors (missing project id, negative `ttlMs`, malformed integration id) throw at call time. Actionable per-integration problems during resolution are downgraded to warn-and-skip so one bad integration never takes down the whole map.

#### Reserved `providerOptions`

`providerOptions` rejects reserved fields at both the type level and at runtime. Two categories, applied per integration:

- **Credentials.** `refreshToken`, `token`, `botToken` are managed by the platform connection. Passing another one via `providerOptions` would silently override the connection and bypass rotation, revocation, and auditing.
- **Framework-managed.** `baseUrl` / `apiBaseUrl` are set by the Mastra server so webhook URLs match the running host. `encryptionKey` is process-wide and cannot be overridden per integration.

Passing any of these is a compile-time error; a runtime cast that bypasses the check is stripped with a warning. Non-reserved provider config (handlers, streaming, default scopes, commands, permissions, etc.) is forwarded unchanged — see each peer package's `ProviderConfig` type for the full option surface.

Discord's `applicationId` and `publicKey` are **not** reserved. They can be supplied via `providerOptions` when the connection doesn't carry them.

#### Launch providers

The three launch providers wrap the corresponding first-party channel packages, so each entry in the returned map is a full `ChannelProvider` with install / OAuth / webhook lifecycle already implemented:

| Provider   | Peer package       |
| ---------- | ------------------ |
| `slack`    | `@mastra/slack`    |
| `telegram` | `@mastra/telegram` |
| `discord`  | `@mastra/discord`  |

Attach the corresponding integration to your Platform project and the resolver takes care of construction — no manual credential wiring, no per-provider setup code in your app.

### Sandbox environment

Some agents run inside a sandbox that shells out to CLIs (git, `gh`) or needs provider tokens in the process environment. `environment()` materializes those credentials from the same project connections `tools()` uses, so an agent that already has GitHub attached needs no separate credential wiring.

```ts
import { environment } from '@mastra/connect';

const env = environment({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
});

const { env: envVars, onStart } = await env();

await sandbox.start({
  env: envVars, // GH_TOKEN, GITHUB_TOKEN, …
  onStart, // runs `git config --global credential.https://github.com.helper …`
});
```

`environment()` mirrors `tools()`: same `projectId`, `client`, and per-provider `integrations` overrides (`connectionId` to pin, `disabled: true` to exclude). GitHub is the first provider with an env contributor — its OAuth token is exported as `GH_TOKEN`/`GITHUB_TOKEN` so both `gh` and `git` HTTPS operations authenticate as the connected user, and `onStart` wires a git credential helper that reads the token from the environment rather than baking it into git config.

### Template provenance

Resend and incident.io are generated from integration-template contributions [#667](https://github.com/NangoHQ/integration-templates/pull/667) and [#668](https://github.com/NangoHQ/integration-templates/pull/668). Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot are generated from contribution [#677](https://github.com/NangoHQ/integration-templates/pull/677), which adds agent-focused actions (PostHog HogQL queries, Stripe balance/dispute/coupon/account reads, GitHub tags and trees, Slack Connect invites, Twitter search and following, HubSpot form submission) on top of upstream main. Until they land upstream, each provider manifest pins the contributing repository and exact commit and records generated file checksums.

## Documentation

- [Mastra Platform](https://mastra.ai/docs/mastra-platform/overview)
- [Maintainer generation commands](./scripts/README.md) and [third-party notices](./NOTICE.md). Generated-provider tests use OpenAPI examples and synthetic fixtures. MCP tests exercise catalog discovery and the protocol lifecycle with a provider-neutral Platform gateway.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/connect/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
