### 11.2 Storage compatibility

This section owns legacy-thread bootstrap compatibility, the legacy key
inventory, and the no-eager-migration rule. It is not the canonical owner for
persisted record shapes, thread metadata write semantics, storage adapter
methods, route payloads, or channel ledgers: §5.1 owns persisted records and
`ThreadMetadata`, §5.2 owns the storage adapter surface, §13 owns server and
wire projections, and §14 owns channel binding, inbox, action, and outbox rows.

Threads written by the legacy `Harness` are readable by the v1 `Harness`. The
thread-record schema is the persistence contract; it is not coupled to either
runtime class. Runtime-state fields that legacy stored in thread metadata
(`currentModeId`, `currentModelId`, `modeModelId_*`, observer/reflector model
IDs, OM thresholds, token usage, working memory, channel subscription fields,
subagent fork markers, project path, and clone/source metadata) are still read
by the v1 `Harness` only as bootstrap or compatibility inputs when opening a
session for an existing thread that lacks persisted v1 values. After bootstrap,
mode/model, OM config, token usage, permissions, channel state, subagent
ownership, and display/list labels are managed by their canonical Session,
memory, channel, subagent, thread, storage, and route owners; generic thread
settings and Harness default-model config do not own runtime state.

Legacy mode/model metadata may seed only missing v1 session defaults through
the canonical bootstrap rules above. It is never proof of a committed run
surface: v1 `currentRun.agentId`, `modeId`, and `modelId` come only from the
run-start resolution against the configured agent registry, mode catalog, and
model resolver.

Legacy clone/source metadata is provenance and compatibility output only. It
does not hydrate v1 session ownership, does not imply a fork or child-session
mapping, and does not make legacy `Harness.cloneThread(...)`,
`Memory.cloneThread(...)`, or `StorageCloneThreadInput` the implementation
contract for v1 `harness.threads.clone(...)`. Those legacy primitives may infer
an active source thread, target another resource, filter messages, copy or roll
back working-memory/observational-memory side effects, or expose adapter-specific
unsupported paths. A v1 clone wrapper must narrow them to the §4.4
same-resource, full-message-snapshot contract and fail before writing if the
configured adapter cannot provide that contract.

Harness v1 does not perform an eager whole-storage migration or promise to
convert every legacy metadata, channel, subagent, memory, or process-local state
shape when a legacy thread is first opened. Legacy top-level metadata is
preserved and may be read only as compatibility input for fields whose owning
v1 contract already defines a stable bootstrap rule. When a legacy shape has no
stable v1 owner yet, v1 must leave the legacy data intact, keep the legacy
subpath functional, and require the focused owner to define an explicit
mapping, relink, ignore, or unsupported-state rule before treating that data as
v1 runtime state.

Legacy/current `MemoryStorage` thread and message APIs are implementation
material behind the v1 Harness adapter, not the adapter contract by themselves.
They may keep serving legacy callers and may be delegated to by the bound v1
adapter, but raw `getThreadById(...)`, `listMessages(...)`,
`saveMessages(...)`, and page/perPage readers are not Harness-facing
thread/message APIs unless the adapter also supplies the §5.2 Harness namespace,
tenant/resource verification, single shared log, duplicate-ID conflict behavior,
and stable cursor ordering.

Legacy/current thread deletion helpers are physical cleanup primitives, not v1
thread-delete implementation aliases. `Harness.memory.deleteThread(...)`,
`Memory.deleteThread(...)`, raw `MemoryStorage.deleteThread(...)`, gateway
thread deletion, and current `/memory/*` delete handlers may remain
legacy/internal paths or final cleanup steps, but a v1
`harness.threads.delete({ threadId, resourceId })` wrapper must first resolve
the thread inside `(harnessName, resourceId)`, run the §5.5 session
close/force-delete cascade and dependent-ledger cleanup, and only then invoke
physical thread/message/vector cleanup.

Legacy observational-memory rows that lack the §5.2 Harness OM namespace remain
legacy memory data. They may stay readable through legacy MemoryStorage or
legacy Harness APIs, but v1 `session.om` reads do not surface them unless the
adapter provides an explicit mapping into the bound `(harnessName, resourceId,
threadId|null)` namespace. Such a mapping must be tenant-safe and must not
expose rows from another Harness or resource; otherwise Harness v1 treats the
legacy OM rows as unsupported advisory data rather than v1 runtime state.

Legacy bootstrap is lazy and per thread, not a one-time storage conversion. The
ordered procedure is:

1. The deployment first exposes the v1 subpath (§11.1) and a Harness-scoped
   storage view (§5.2). If the configured adapter cannot provide the required
   Harness namespace or shared message-log view, the v1 Harness fails
   registration or session creation at that boundary instead of partially
   importing legacy rows.
2. Opening an existing legacy thread resolves the thread through the v1
   `(harnessName, resourceId, threadId)` checks. Cross-resource,
   cross-harness, missing-resource, or ambiguous ownership evidence is not
   repaired by migration; it fails closed or follows the focused owner's
   explicit relink/unsupported-state rule.
3. If an active v1 `SessionRecord` already exists for the tuple, that record is
   authoritative. Legacy top-level metadata is preserved for legacy readers and
   compatibility output, but it is not re-evaluated to change v1 runtime state.
4. If no active v1 `SessionRecord` exists, the v1 Harness enters the normal
   active-session creation path so concurrent cold opens converge on one record.
   The initial record may seed only fields whose canonical owner defines a
   deterministic, valid legacy bootstrap rule; otherwise it uses v1 defaults or
   persisted v1 values.
5. Malformed, ambiguous, unsupported, or ownerless legacy fields are ignored for
   v1 runtime state and left unchanged in thread metadata. They do not create
   channel bindings, child-session parentage, durable state, permissions, or
   message-log namespace changes unless the focused owner explicitly defines
   that mapping.
6. V1 mutators preserve unknown top-level legacy metadata and write only through
   typed v1 owners. Mirroring selected keys for legacy readers is compatibility
   output, not a second runtime authority.

Legacy file parts and `experimental_attachments` inside existing `MessageList`
history are not v1 `PersistedAttachment` references. They often contain raw
data URIs, base64 payloads, process-local file paths, or expiring provider URLs.
Harness v1 does not silently accept these as replay-safe inputs. When opening a
legacy thread or hydrating message history, the adapter must define a concrete
fallback: either treat the legacy records as immutable display-only history
(rejecting them if used as live inputs for a new operation), lazily ingest them
into Harness-owned attachment storage when possible, or explicitly strip/reject
malformed URL payloads. Legacy raw file data must not masquerade as a
`PersistedAttachment` ref, and any v1 inline, URL, pre-uploaded, or
channel-ingested input must be normalized into a `PersistedAttachment` ref
before any new durable queue, signal, message-history, current-run,
channel-inbox, wakeup, or outbox-projection row is written.

Legacy `Harness.state`, `harness.getState()`, and `harness.setState(...)` are
process-local compatibility surfaces, not persisted legacy thread data and not
the v1 storage contract. Opening a legacy thread through v1 must not hydrate
`SessionRecord.state` from a live legacy Harness instance, a previous process's
lost state object, or legacy `state_changed` events. New v1 session state is
seeded only by the v1 session-creation/config bootstrap rules owned by §9 and
§5.1, then mutated only through `SessionRecord.state` under §5.8. A legacy
application that wants to carry an old initial value into v1 must supply it
through the explicit v1 creation/import path before the `SessionRecord` is
created, and that candidate still must pass §5.1 JSON/lossless validation.

Legacy `forkedSubagent: true` / `parentThreadId` metadata is not a v1
child-session mapping by itself. A direct explicit open of the legacy fork
thread may create or load only the normal active `SessionRecord` for that
`(harnessName, resourceId, threadId)` with `parentSessionId` unset, unless a
product/operator import supplies a tenant-safe relink rule. Resource-only
startup, ordinary thread lists, and automatic bootstrap must not select a hidden
legacy fork as a child session merely because the legacy metadata exists.

Any relink/import must participate in the same storage-linearized
active-session creation boundary as ordinary bootstrap. It must resolve
`parentThreadId` to exactly one parent `SessionRecord` in the same Harness
namespace and resource scope; ambiguous, missing, cross-resource, closing, or
already-standalone-active cases fail closed or follow the operator's explicit
unsupported-state rule. When the parent is active, the imported child sets
`parentSessionId` and derives depth from the persisted parent chain, not from
legacy metadata. When the parent is closed, import can only create/link a
closed or historical child if a product/operator explicitly supports that mode;
it must not create a new active child under a closed parent.

Without such explicit relink/import, legacy fork threads do not appear in
`listChildSessions(...)`, do not synthesize `subagentSessionId`, `parentId`, or
`depth`, and do not backfill historical parent-stream `subagent_*` events.
Legacy non-forked subagent calls remain recoverable only as parent
thread/tool/message history because the legacy runtime did not persist a child
thread or child session for them.

Legacy channel subscription metadata is compatibility input only. The legacy
top-level `channel_subscribed`, `channel_externalThreadId`,
`channel_externalChannelId`, `channel_platform`, and adjacent legacy
`channel_*` keys do not create, modify, claim, or invalidate a v1
`ChannelBinding` on their own and are not promoted into a per-principal
read-state, unread, muted, notification, or `lastSeen` surface (§11.5, §15.3).
The §14.1 binding key and the §14 channel bridge are the canonical owner of
durable platform-conversation-to-session mapping; legacy `channel_*` metadata
never becomes a second authority.

- A legacy thread with `channel_subscribed === 'true'` plus mapping metadata
  does not pre-create a `ChannelBinding`, does not pre-claim §14.1
  binding-key identity, and does not by itself authorize outbound delivery
  to the platform conversation. The first provider-authenticated ingress
  that matches the §14.1 binding key creates a fresh active binding
  (generation 1) the normal way; the legacy `true` flag does not change
  generation, resource, or session resolution.
- `channel_subscribed === 'false'` and absent values mean the same: legacy
  metadata is not authority for v1 binding state. Closing, replacement, and
  undeliverable transitions are owned by §14.1 binding terminal states, not
  by `channel_subscribed === 'false'`. v1 admission for new ingress is not
  blocked by a legacy `false` flag.
- When a fresh v1 binding resolves to the same `(harnessName, channelId,
  platform, externalTenantId, externalChannelId, externalThreadId)` tuple,
  the legacy thread is reusable as the bound `threadId` only when the v1
  `(harnessName, resourceId, threadId)` lookup already succeeds for the
  resolved resource. Ambiguous, cross-resource, cross-harness,
  missing-evidence, or non-matching cases follow the §11.2 fail-closed
  bootstrap rule and the §14.1 binding-key rules instead of being relinked
  from `channel_externalThreadId` / `channel_externalChannelId` /
  `channel_platform` alone. The legacy `channel_*` metadata is preserved on
  the thread for legacy readers but is not consulted by Harness runtime
  logic to choose, replace, or scope a binding.
- Legacy `AgentChannels` history-fetch on first mention and the legacy
  `StateAdapter` `subscribe(...)` / `unsubscribe(...)` / `isSubscribed(...)`
  calls remain live-only behavior. They are not the v1 admission or
  delivery path under an active `ChannelBinding`: history bootstrap,
  follow-up routing, and outbound delivery follow §14.1 binding-backed
  admission and §14.4 outbox dispatch, not legacy `channel_subscribed`.
- An explicit operator/product migration MAY upgrade a legacy
  `channel_subscribed === 'true'` thread into an active v1 `ChannelBinding`,
  but only by supplying trusted `harnessName`, `channelId`, `providerId`,
  `platform`, `externalTenantId`, `externalChannelId`, `externalThreadId`,
  `resourceId`, and either an existing active `sessionId` or sufficient
  inputs for §14.1 session derivation. It must enter the same
  storage-linearized binding-creation boundary as fresh ingress; it must
  not create an active binding under a closed or deleted owning session; it
  must not collide with an existing active binding for the same key; and it
  must not replay missed legacy inbound messages as new v1
  `ChannelInboxItem` rows. Without such an explicit, tenant-safe import
  path, legacy channel subscription metadata stays compatibility output and
  never becomes v1 channel runtime state.

Public thread metadata write semantics are owned by §5.1 and §5.2, with the
wire form owned by §13.2: `session.setThreadSetting(...)` writes only
`thread.metadata.app[key]`, never raw top-level metadata. For migration
compatibility, the reserved top-level legacy key inventory includes `harness`,
`mastra`, `MastraMemory`, `channel_*`,
`currentModeId`, `currentModelId`, `modeModelId_*`, `observerModelId`,
`reflectorModelId`, `observationThreshold`, `reflectionThreshold`, `tokenUsage`,
`workingMemory`, `projectPath`, `forkedSubagent`, `parentThreadId`,
`subagentModelId`, `subagentModelId_*`, `clone`, `title`, and `metadata`.
Typed v1 mutators may mirror selected legacy keys for legacy readers, but that
mirror is compatibility output only. Application callers cannot write those keys
directly, and Harness runtime logic must never consult `metadata.app` for
session hydration, mode/model selection, permission policy, OM configuration,
token accounting, channel routing, subagent ownership, or thread titles.
