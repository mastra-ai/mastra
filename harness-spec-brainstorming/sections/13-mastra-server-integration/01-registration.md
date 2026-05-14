### 13.1 Registration

Orientation diagram (registration ownership only; code and registry rules below
remain authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-registration-title hx-registration-desc" viewBox="0 0 1080 470" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-registration-title">Mastra harness registration and channel registry</title>
    <desc id="hx-registration-desc">Mastra registration binds named harnesses and channel providers during init, validates storage namespaces and route ownership, then exposes routes through the server channel registry.</desc>
    <defs>
      <marker id="ah-registration" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="65" y="70" width="190" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="160" y="100" text-anchor="middle">Mastra config</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="160" y="123" text-anchor="middle">harness + channels</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="330" y="35" width="200" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="430" y="63" text-anchor="middle">Named harnesses</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="430" y="85" text-anchor="middle">coding / support / default</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="330" y="135" width="200" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="430" y="163" text-anchor="middle">Channel providers</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="430" y="185" text-anchor="middle">providerId registry</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="605" y="85" width="220" height="78" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="715" y="116" text-anchor="middle">Init barrier</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="715" y="139" text-anchor="middle">namespace / route / ownership checks</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="605" y="255" width="220" height="78" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="715" y="286" text-anchor="middle">Channel registry</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="715" y="309" text-anchor="middle">harness + channel lookup</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="880" y="155" width="165" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="963" y="185" text-anchor="middle">HTTP routes</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="963" y="208" text-anchor="middle">exposed after init</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="880" y="310" width="165" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="963" y="340" text-anchor="middle">Provider callbacks</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="963" y="363" text-anchor="middle">trusted route context</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-registration);" d="M255 96 C285 75 305 68 329 68" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-registration);" d="M255 116 C285 140 305 163 329 168" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-registration);" d="M530 69 C565 80 585 95 604 112" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-registration);" d="M530 169 C565 155 585 145 604 135" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-registration);" d="M715 164 L715 254" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-registration);" d="M825 124 C860 140 890 158 907 181" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-registration);" d="M825 294 L879 335" />
  </svg>
  <figcaption>Registration is an awaited boot boundary: routes and callbacks are exposed only after harness, storage, provider, and route ownership checks succeed.</figcaption>
</figure>

```ts
import { Mastra } from '@mastra/core';
import { Harness } from '@mastra/core/harness/v1';

const codingHarness = new Harness(codingConfig);
const supportHarness = new Harness(supportConfig);

const mastra = new Mastra({
  agents: { /* ... */ },
  workflows: { /* ... */ },
  harness: {
    coding: codingHarness,
    support: supportHarness,
  },
});

// In-process access — same shape as `getAgent`, `getWorkflow`, etc.
const harness = mastra.getHarness('coding');
const session = await harness.session({ resourceId });
```

Single-harness sugar for the common case:

```ts
new Mastra({ harness: codingHarness });
// equivalent to:
new Mastra({ harness: { default: codingHarness } });

mastra.getHarness();           // returns the default harness
mastra.getHarness('default');  // same
```

`mastra.init()` binds the immutable registered `harnessName` and calls
`harness.init()` on every registered harness. `mastra.shutdown()` calls
`harness.shutdown()` on every registered harness.

Harness server registration is an awaited boot barrier, not a lazy route side
effect. The server normalizes single-harness sugar into the named registry
(`default`), binds each Harness storage view to that immutable `harnessName`,
attaches configured channel providers, builds the harness-channel registry,
validates route, storage namespace, and installation ownership, and only then
exposes Harness HTTP/channel routes. If any registered harness channel or shared
storage namespace fails validation, boot fails before a channel webhook can be
accepted.

### Harness/channel registry

Mastra Server is the central registry for multi-harness channel routing. A
deployment may register X harnesses and Y channel providers:

```ts
const mastra = new Mastra({
  agents: { /* ... */ },
  channels: {
    slack: slackProvider,
    discord: discordProvider,
  },
  harness: {
    coding: codingHarness,
    support: supportHarness,
  },
});
```

Each `HarnessConfig.channels` entry is keyed by the Harness `channelId`. By
default that key names a registered Mastra channel provider
(`channels[channelId]`); a config may use `providerId` when the local Harness
channel key differs from the Mastra provider key. Current Mastra core already
has a process-level `channels` config, merges `ChannelProvider.getRoutes()` into
server routes, separately appends `AgentChannels` webhook routes from registered
agents, and initializes providers asynchronously after agents are registered
(`packages/core/src/mastra/index.ts`, `packages/core/src/channels/types.ts`,
`packages/core/src/channels/agent-channels.ts`). The route ownership and
collision checks below are new Harness v1 registry requirements; current core
mostly appends route arrays and does not provide this Harness-specific control
plane. Harness v1 cannot rely on append order or lazy provider initialization
for routing safety: it builds `HarnessChannelRegistry` as an awaited server
startup step before accepting Harness channel webhooks. Conceptually, during
`mastra.init()`, the registry is built from:

- registered harnesses (`harnessName -> Harness`);
- registered channel providers (`providerId -> ChannelProvider`), where
`providerId` is the Mastra `channels` registration key, not the provider's
platform/type ID;
- each harness's channel bridge config
(`harnessName + channelId -> HarnessChannelConfig`);
- server route ownership for Harness channel routes, provider-owned routes, and
legacy `AgentChannels` routes;
  - trusted provider callback bindings for provider-owned routes, loaded through
    the §5.2 storage adapter methods and validated at init;
- a lazy binding namespace for persisted `ChannelBinding` records, keyed by
`(harnessName, channelId, bindingId | platform + external ids)` and validated
against the row's stored `providerId`.

After `mastra.init()`, the `HarnessChannelRegistry` is the single merged
router for the route table described below. `ChannelProvider.getRoutes()`
(`packages/core/src/channels/types.ts`) and legacy `AgentChannels` live-mode
route declarations are admitted into the same normalized `(method, path)`
table; they do not run alongside the registry as independent routing layers.
Provider-owned routes remain provider-routed at runtime, but their ownership
is resolved through the registry before any bridge call. Current provider
initialization in `packages/core/src/mastra/index.ts` is async and runs
after agent registration; the `HarnessChannelRegistry` build step must be
awaited (provider init included) before the server accepts any
`/harness/:harnessName/channels/:channelId/...` webhook traffic. Init-time
validation below guarantees no overlapping route ownership between
harness-managed, provider-owned, and legacy `AgentChannels` routes.

Validation happens at init:

- every `HarnessConfig.channels[channelId]` must refer to a Mastra-level
provider (`channels[providerId ?? channelId]`), unless the harness config
supplies a fully self-contained adapter for local tests;
- if two registered harnesses share the same physical storage adapter or
database namespace, that adapter must declare and enforce Harness namespaces for
Harness-domain ledgers and the shared MemoryStorage thread/message view (§5.2).
Adapters that only expose an unscoped global `threadId` / `sessionId` keyspace
are allowed only when the physical namespace is used by a single registered
Harness; otherwise boot fails with `HarnessConfigError`;
- every mounted route has a unique normalized `(method, path)` across Harness
routes, provider routes, legacy `AgentChannels` routes, and custom `apiRoutes`.
Shadowing is an init error; route registration order is not a
conflict-resolution mechanism;
- every Harness channel route is unique by `(harnessName, channelId)`;
- local-test adapters that do not resolve to a Mastra-level provider are not
auto-mounted on Mastra Server and cannot receive externally reachable provider
callbacks;
- every externally mounted channel adapter must verify inbound and action
callbacks for its provider; omitting `verifyInbound` / `verifyAction` is valid
only for local/test adapters that are never exposed as webhook routes;
  - a channel provider can be shared by multiple harnesses, but provider ID
    alone never chooses the Harness target. The direct inbound route or a
    trusted provider callback binding must identify exactly one
    `(harnessName, channelId, providerId)`;
  - a provider-owned callback binding is unique by `providerId` plus its trusted
    route/install key, following the durable `HarnessProviderCallbackBinding`
    storage contract in §5.2. A single provider installation or route selector
    maps to at most one active registered `(harnessName, channelId)` pair;
    fan-out from one selector requires separate provider-owned
    installation/route keys or an application-level bridge outside Harness v1. A
    callback with no binding or more than one active binding is rejected before
    adapter normalization; the raw provider payload is never used as a fallback
    target selector;
- a harness-bound provider/installation/thread target must not also be mounted
through legacy `AgentChannels` webhook routes, channel action handlers, or
injected channel tools that call the live `agent.stream(...)` /
`agent.approveToolCall(...)` / `agent.resumeStream(...)` / platform-post path.
Overlap is an init error unless the live route uses a separate installation or
route namespace whose ownership cannot collide with the harness-bound channel;
- a persisted binding whose `harnessName` or `channelId` is no longer registered
is left in storage. It is marked `undeliverable` when loaded for ingress/outbox
dispatch until the deployment restores the missing component or an operator
migrates/deletes the binding.

The registry owns the server-level route fan-out:

```
/harness/:harnessName/channels/:channelId/inbound
  -> HarnessChannelRegistry.resolve(harnessName, channelId)
  -> adapter.verifyInbound(raw, routeContext)
  -> harness.channels.ingest(...)

/harness/:harnessName/channels/:channelId/actions
  -> HarnessChannelRegistry.resolve(harnessName, channelId)
  -> adapter.verifyAction(raw, routeContext)
  -> harness.channels.respondToAction(...)
```

Provider-owned routes can also call into the registry after they verify the
platform request, but they must supply or derive the same
`(harnessName, channelId, providerId)` route context before invoking the Harness
bridge. The raw provider payload is never allowed to self-select an arbitrary
harness, channel, resource, session, mode, model, or permission grant.

For shared provider-owned routes, the trusted input is an installation or route
binding established during provisioning/connect and durably stored as a
`HarnessProviderCallbackBinding` row (§5.1, §5.2). The selector discriminator
carries the provider-specific identity:

```ts
type HarnessChannelProviderSelector =
  | { kind: 'installation'; installationId: string }
  | { kind: 'route-key'; routeKey: string }
  | { kind: 'external-tenant'; externalTenantId: string; externalChannelId?: string };
```

The provider defines which selector kind is trusted for each callback route.
The registry resolves provider callbacks through the §5.2 callback-binding
storage methods and falls through to `ChannelBinding` resolution for
thread-scoped events. Init-time validation scans active callback bindings for
every registered Harness/channel pair, or uses an equivalent provider-scoped
adapter scan, before accepting provider webhooks. Conflicting callback bindings
are provisioning conflicts; the init barrier rejects them before accepting
provider webhooks. Payload fields may help find the provider installation, but
they do not directly name the Harness target.

This keeps each Harness as restartable process-local orchestration
infrastructure for its own sessions, while Mastra Server remains the
process-wide control plane that knows which harnesses and channel providers
exist.

### Mastra-level channel operator surface

Per-harness `harness.channels.dispatchOutbox(...)` can only claim rows owned by
that harness. Cross-harness channel workers are Mastra Server operator code and
use the registry, not an arbitrary harness instance:

```ts
mastra.harnessChannels.dispatchOutbox(opts?: MastraChannelOperatorDispatchOptions): Promise<ChannelDispatchResult>;
```

`MastraChannelOperatorDispatchOptions.harnessName` narrows the worker to one
harness when present. Omitting it is allowed only for an explicit operator
worker that intentionally scans all registered harness/channel ownership scopes.
The registry applies the same provider, route, binding-generation, and ownership
validation described above before any row is delivered.

This operator surface is an in-process trust boundary, like direct access to
`mastra` itself. Harness v1 does not define a public cross-harness HTTP endpoint
for it; deployments that expose one must wrap it in their own operator
authentication, authorization, audit logging, and rate limiting before invoking
the in-process method.
