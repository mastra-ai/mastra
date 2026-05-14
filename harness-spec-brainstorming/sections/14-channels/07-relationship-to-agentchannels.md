### 14.7 Relationship to AgentChannels

Harness does not absorb `AgentChannels` internals. Current Mastra
`ChannelProvider`s own platform lifecycle: credentials, OAuth/provisioning,
`getRoutes()`, `__attach(mastra)`, initialization, and connect/disconnect flows.
`AgentChannels` remains the per-agent live convenience pipeline for non-Harness
mode. In Harness mode, provider/adapters and formatting hooks can be reused
behind the bridge, but the live `AgentChannels.handleWebhookEvent(...)`,
`consumeAgentStream(...)`, and generic channel-tool path are not the bridge
contract. Reuse means adapter-level verification, normalization, formatting, and
platform send/edit helpers are called from the inbox/outbox bridge after durable
rows exist. Their responsibilities change:

- provider-owned OAuth/provisioning routes may stay provider routes, while
Harness bridge routes or provider callbacks must identify
`(harnessName, channelId)` before ingress;
- provider-owned event/action routes that restore an existing installation must
restore a Harness owner or a legacy agent owner, never both;
- provider webhook verification and normalization stay adapter/provider
concerns, but the registry route context is authoritative for `harnessName`,
`channelId`, and `providerId`;
- platform thread/user IDs are resolved into `ChannelBinding` before session
admission;
- prompt-time channel metadata is carried through `requestContext.channel`;
- text, files, cards, edits, reactions, and errors are emitted through durable
outbox dispatch;
- approval actions answer Harness inbox items.

Init must fence these modes. A provider/installation/thread target that is bound
to Harness mode MUST NOT also be mounted through legacy `AgentChannels` webhook
routes, provider callbacks that delegate to
`AgentChannels.handleWebhookEvent(...)`, action handlers that call
`agent.approveToolCall(...)` / `agent.resumeStream(...)`, or generic channel
tools that post directly to the platform. Mastra Server either disables/rejects
the overlapping live surface at init or requires a separate live-only
route/installation whose ownership cannot collide with the harness-bound
`(harnessName, channelId, providerId)` pair.

§14.7 init enforces the route/installation/thread fence above; §14 admission
enforces the model-visible tool fence. During §4.2 pre-exposure gate
evaluation for each turn admitted under an active `ChannelBinding`, the
Harness channel bridge contributes the strip: `AgentChannels.getTools()`
direct-provider tools are omitted from the model-visible tool surface
(replaced with the Harness-owned outbox-backed reaction tools defined in
§14.4 when the bridge enables them), and per-turn `addTools` overrides that
introduce tools matching `AgentChannels.getTools()` by tool name, provenance
metadata, or harness-known channel-tool identity are also rejected at the
same gate regardless of permission policy. For subagent sessions the child
session's tool surface is constructed through the same gate; child sessions
do not independently call `AgentChannels.getTools()` and the strip applies
identically. An agent whose `AgentChannels` is configured with `tools: true`
— or whose configuration relies on the current default-true behavior — for
an adapter whose `(channelId, providerId)` is harness-bound is a probable
misconfiguration and SHOULD log a registry init warning; the warning is
informational and does not block init, since admission-time stripping is the
load-bearing fence and the route/installation/thread fence above prevents
the same `(harnessName, channelId, providerId)` pair from also being
mounted through the legacy live `AgentChannels` surface. Legacy non-Harness
installations of the same `AgentChannels` instance remain usable through the
separate live-only route/installation already required above.

The same fence covers legacy `AgentChannels` server-side URL inspection
and inline-link promotion. The current `inlineLinks` path either runs an
unrestricted `fetch(url, { method: 'HEAD', redirect: 'follow' })` through
`headContentType(...)` (string-rule entries) with no §13.7 scheme,
redirect, private-network/metadata, credential, timeout, byte, MIME, or
digest controls, or skips the HEAD and pushes a raw URL directly into a
model file part (forced-MIME `{ match, mimeType }` entries). Neither
branch is a Harness v1 ingestion primitive. For a harness-bound
`(harnessName, channelId, providerId)` target, the legacy inline-link
path either routes each URL through the §13.7 URL ingestion helper before
any Harness v1 durable row references it, or inline-link URLs remain in
the inbound message text and are not promoted to v1 attachments.
Live-only `AgentChannels` installations that do not feed Harness v1
admission keep their existing inline-link behavior under the separate
live-only route/installation that §14.7 already requires, accepting the
known limitations of an unrestricted server-side fetch.

For migrated installations, the registry treats an existing agent-owned provider
installation as live-mode ownership until an explicit migration durably records
a `HarnessProviderCallbackBinding` row through
`resolveProviderCallbackBinding(...)`. A Harness channel must not infer
ownership from matching provider IDs, bot credentials, external tenant IDs, or
display names.

This keeps Channels per-agent while preventing channel users from bypassing the
Harness guarantees that matter: session identity, permissions, durable input,
resumable approvals, event ordering, and proactive outbound delivery.
