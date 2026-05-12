### 14.1 Channel Binding

A `ChannelBinding` is the durable mapping between a platform conversation and a
Harness session. The `ChannelBindingMode` enum and the `ChannelBinding` row
shape are declared canonically in §5.1h; §14 owns binding resolution, lifecycle
transitions, and dispatch behavior described below.

Binding resolution is controlled by `ChannelIngressPolicy` (§9), not by platform
payload fields directly. `mode` records the trusted resource-resolution policy
that was used; platform shape stays in `conversationKind` and `trigger`. The
policy maps:

```
harnessName + channelId + providerId + platform + conversationKind + trigger
  + externalTenantId + externalChannelId + externalThreadId + actor
  -> resourceId + threadId + sessionId
```

There can be only one active binding for a given
`(harnessName, channelId, platform, externalTenantId, externalChannelId, externalThreadId)`
tuple. Replacements mark the previous binding `replaced` rather than creating
two active owners for the same platform conversation. Missing optional external
IDs are normalised to a sentinel value for uniqueness; storage adapters must not
rely on SQL `NULL` uniqueness semantics.

The adapter owns canonical platform identity. It verifies the provider request,
rejects any payload whose platform disagrees with the registry route context,
classifies the conversation as `dm`, `group-dm`, `channel`, or `thread`, and
records why this ingress fired (`message`, `mention`, `subscribed-message`, or
`command`). For tenant-scoped platforms, the canonical identity includes the
tenant: Slack uses the workspace or enterprise/team ID, channel or DM
conversation ID, and thread timestamp/conversation ID; Discord uses the guild ID
for guild conversations and channel/thread ID for the conversation, with DMs
using the DM channel as the conversation. Provider message IDs stay in
`externalMessageId` for inbox idempotency; they are not part of the binding key.
If the adapter cannot produce stable tenant/channel/thread identifiers for a
platform where IDs are only scoped locally, the bridge rejects the ingress
before `resolveResource`.

Rules:

- DMs may map to a per-human resource only after the application has linked the
platform user to that Harness resource. Without a link, the policy either maps
to a platform-scoped resource (for example `slack:workspace:T123:user:U456`) or
rejects the message.
- `per-user-resource` is valid only for single-user DMs or for an
application-defined single-user installation. It is not valid for Slack
channels, Discord guild channels, public threads, group DMs, or any other
multi-user conversation, because the binding key intentionally does not include
the current actor.
- Multi-user channel threads MUST map to one explicit logical resource, such as
a project, installation, shared Slack channel, or product account. The current
message author is recorded as `requestContext.channel.actor`; it is not
automatically the Harness `resourceId`, and it cannot change an existing
binding's `resourceId`.
- The same human on Slack and Discord may resolve to the same `resourceId` only
through an application identity-linking policy. Matching display names or
platform user IDs across platforms is not a Harness primitive.
- A binding may point at an existing active session or create a fresh session
with deterministic IDs. If the policy omits `threadId`, the bridge derives a
stable, namespaced ID from the resolved `resourceId` and canonical platform
conversation tuple. If the policy omits `sessionId`, the bridge derives or
creates one from the canonical tuple plus `generation`. Closed sessions are not
reopened; the bridge creates a new binding with
`generation = previous.generation + 1`, derives a new session ID for that
generation, and updates/replaces the old binding with `status: 'replaced'` and
`replacedByBindingId`.
- A binding becomes `closed` when the owning session is closed or deleted, the
platform installation/conversation is explicitly unlinked, or an operator closes
it. Closed bindings are non-active and never dispatch new outbox items. Session
deletion uses `closedReason: 'session_deleted'` per §5.5 and never automatically
retargets or replaces the binding. New ingress for the same platform
conversation creates a fresh active binding and session generation only if the
channel policy permits replacement; otherwise the ingress is rejected or
dead-lettered.
- A binding whose harness/channel/provider is no longer registered is not
deleted by init. It becomes effectively undeliverable when loaded or claimed for
dispatch: the bridge sets `status: 'undeliverable'` or fails the outbox item
until an operator restores the component or migrates/deletes the binding.
- Subagent sessions do not create separate channel bindings. Outbound prompts
emitted by subagents use the owning session from the pending item
(`subagentSessionId` when present) but deliver to the parent/root binding unless
a future section explicitly defines subagent-specific delivery.
