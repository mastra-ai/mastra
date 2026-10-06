# @mastra/connect

`@mastra/connect` exposes tools backed by connections attached to a Mastra Platform project. Provider credentials stay in the platform connection. Tool traffic passes through Platform so calls can be authorized, audited, and counted without logging arguments or results.

## Installation

```bash
npm install @mastra/connect
```

## Usage

Attach connections to your Platform project, configure the project ID and access token, then pass the resolver to your agent's `tools` option:

```ts
import { tools } from '@mastra/connect';

const connectTools = tools({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
});

const agent = new Agent({
  // ...
  tools: connectTools,
});
```

The resolver is live: Mastra calls it per generate/stream, so providers connected to (or disconnected from) the project are picked up without a restart.

### Combining with your own tools

Use `.with()` to merge local tools into every resolution. It accepts a static record or a (sync or async, optionally context-reading) function; your tools win on key collision, and calls chain:

```ts
const agent = new Agent({
  // ...
  tools: connectTools.with({ weatherTool }),
});
```

### Choosing providers

The `providers` option accepts two shapes:

```ts
// Array — an allowlist: only these providers resolve.
tools({ providers: ['resend', 'incident-io'] });

// Record — per-provider configuration. Every connected provider resolves
// unless excluded: `true` (or `{}`) enables with defaults, `false` (or
// `{ disabled: true }`) excludes, and an object configures the provider.
tools({
  providers: {
    resend: { allowTools: ['resend_send_email'] },
    linear: { requireApproval: ['linear_delete_*'] },
    github: false,
  },
});
```

An id that is neither a checked-in provider nor a platform catalog integration fails with `invalid_options`, so typos never resolve to silence.

### Filtering and approval

- `allowTools` / `disallowTools` (mutually exclusive per provider) restrict a provider's toolset. Entries containing `*` are globs (`'linear_get_*'`). Unknown names and globs that match nothing throw, so access-limiting typos surface immediately.
- `requireApproval` opts tools into approval. Tools do not require approval by default, matching `@mastra/mcp`'s own default. Pass `true` for every tool on the provider, or an array of keys/globs for a selection — e.g. `neon: { requireApproval: ['neon_delete_project'] }`. Applies to discovered MCP tools and generated HTTP tools alike.
- All three are also accepted at the top level of `tools()` as defaults for every provider. Per-provider options win wholesale, so `requireApproval: true` globally with `linear: { requireApproval: false }` gates everything except Linear. Top-level entries apply leniently (an entry that matches nothing on one provider simply doesn't apply there) and warn when they matched nothing anywhere.

### Multiple connections

The resolver discovers active project connections. Where multiple connections match a provider, pin one with the provider's `connectionId` option, or leave it unpinned and let the agent route each call: the provider's `<integrationId>__list_connections` tool is added, every other tool takes a required `connection_name`, and the agent uses the display names returned by `list_connections` to pick a connection per call.

### MCP integrations

`tools()` also discovers any attached integration that advertises `capabilities.mcp: true` in the Platform catalog. No provider-specific registration or release of `@mastra/connect` is required. Discovered tools use the same flat dynamic-tool contract and are namespaced as `<integration-id>_<tool-name>`.

Every MCP provider uses `/v2/connections/:connectionId/mcp` for discovery and invocation. The adapter reuses each provider's MCP session across refreshes and closes sessions when the connection changes, is detached, or `disconnect()` is called. If an integration has both checked-in HTTP tools and an MCP capability, the MCP catalog is preferred.

The application sends only its Mastra Platform token. The transport is locked to the selected Platform connection URL. Platform removes caller authentication before Nango injects the provider credential and proxies each protocol request to the MCP server configured for that Nango integration.

MCP tool catalogs can change independently of this package. Use `allowTools` to give an agent the smallest useful subset.

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

### Template provenance

Resend and incident.io are generated from integration-template contributions [#667](https://github.com/NangoHQ/integration-templates/pull/667) and [#668](https://github.com/NangoHQ/integration-templates/pull/668). Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot are generated from contribution [#677](https://github.com/NangoHQ/integration-templates/pull/677), which adds agent-focused actions (PostHog HogQL queries, Stripe balance/dispute/coupon/account reads, GitHub tags and trees, Slack Connect invites, Twitter search and following, HubSpot form submission) on top of upstream main. Until they land upstream, each provider manifest pins the contributing repository and exact commit and records generated file checksums.

## Documentation

- [Mastra Platform](https://mastra.ai/docs/mastra-platform/overview)
- [Maintainer generation commands](./scripts/README.md) and [third-party notices](./NOTICE.md). Generated-provider tests use OpenAPI examples and synthetic fixtures. MCP tests exercise catalog discovery and the protocol lifecycle with a provider-neutral Platform gateway.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/connect/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
