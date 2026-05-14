### 5.1i Persistence Contracts


For `HarnessRunOperationRef.kind === 'message'`, `signalId` is required once
`currentRun.status` is `running` or later. For `kind === 'queue'`, `signalId`
is required once the queued item has drained into an agent signal. These fields
are correlation pointers into the signal/queue result records described above;
they are not sufficient on their own to resolve a caller promise after restart.

For `QueueAdmissionReceipt`, `queued` means the item is durably appended and has
not started signal admission. `admitting` means a drain attempt may be in flight
but the harness has not durably recorded `signalId`. The receipt is written
`admitting` durably before `sendSignal(...)` is called. Hydration of `queued`,
`admitting`, or retryable `admission_failed` work retries the same signal
admission with the persisted `admissionId` and `admissionHash`; if the agent
boundary already accepted that admission, it must return the original `runId` /
`signalId` so the receipt can advance to `accepted`. A truly unaccepted
admission is accepted for the first time or moves through `admission_failed`
with `attempts`, `nextAttemptAt`, and `error` according to retry policy. Once a
receipt is `accepted`, `completed`, or post-acceptance `failed`, `runId` and
`signalId` identify the accepted signal and recovery observes or reconciles that
run; it must not start a fresh signal for the same `queuedItemId`. The agent
admission boundary must return the original `runId` / `signalId` for an
already-accepted duplicate admission.

Queue admission and recovery do not use an independent claim field. The owning
session's lease (§5.8) gates all writes to `QueueAdmissionReceipt`, so recovery
of `admitting`, `admission_failed`, or accepted-but-unfinished queue work first
requires acquiring the owning session lease.

**Harness stable-hash canonicalization profile.** Stable JSON-derived hashes
(`payloadHash`, `admissionHash`, `responseHash`, `metadataHash`, and any future
persisted `*Hash` over a JSON DTO) are computed from one Harness-owned profile
so storage adapters, SDKs, recovery workers, and channel bridges cannot invent
incompatible hash bytes.

The hash input is first converted into an explicit normalized DTO and validated
as `JsonValue` (§6.1). This validation rejects `undefined` anywhere in the
structure, sparse arrays/array holes, functions, `symbol`, `BigInt`, `NaN`,
`Infinity`, `-0`, class instances, custom prototypes, getters/setters,
`toJSON`-dependent values, `Map`, `Set`, `Date`, binary buffers, circular
references, and any other value that is not already a plain JSON value. Such
values must be converted by the caller or adapter into an explicit JSON DTO
before validation, such as an ISO string, epoch number, base64/content digest
string, or attachment reference. The harness does not silently coerce them
during hashing.

DTO construction omits absent optional object properties before hashing and
preserves explicit `null` as data. When a missing optional channel identifier
must participate in uniqueness or hash material, the DTO uses the reserved
sentinel string `"\u0000harness:missing"` before canonicalization; adapters must
reject or escape real provider IDs equal to that sentinel so absence cannot
alias a platform-supplied ID. Attachment/file entries use only stable provider
file IDs, deterministic stored attachment IDs, size/digest metadata when
semantically part of the operation, or content digests; they never hash
process-local paths, expiring URLs, temporary provider URLs, or freshly
allocated random IDs.

After DTO construction, the normalized `JsonValue` is serialized with RFC 8785
JSON Canonicalization Scheme rules: no insignificant whitespace, object
properties sorted recursively by the JCS property-name ordering, arrays kept in
order, JSON primitives serialized canonically, and no Unicode normalization
beyond preserving the exact JSON string value accepted into the DTO. Raw wire
JSON bodies whose member names directly become hash material must be parsed with
duplicate object-name rejection, or the adapter must build a fresh DTO from
trusted parsed fields and hash that DTO instead of the raw object. The canonical
JSON string is encoded as UTF-8 and hashed with SHA-256; persisted hash strings
are lowercase hexadecimal.

`transportHash` is the only current non-JSON stable hash: it is SHA-256
lowercase hex over the exact rendered token string/handle encoded as UTF-8 after
the channel bridge has chosen the stable rendering. It still must not include
process-local object identity or nondeterministic data. A retry with the same
idempotency key but a different stable hash is a conflict, not an overwrite.

For channel durability, the persisted JSON value is the hash input. Candidate
outbox payloads, action responses, and provider receipt metadata may enter
adapter APIs as `unknown`, but the bridge stores only the adapter-normalized
`JsonValue`. Non-JSON outbox payloads and action responses reject before any
durable write or first-response receipt creation. Optional provider receipt
metadata that is non-JSON after provider acknowledgement is omitted or replaced
with a redacted JSON summary rather than forcing a duplicate-prone resend.

`InboxResponseReceipt` recovery is claimed by acquiring the owning
`SessionRecord` lease. There is no separate receipt claim table: a recovered
owner scans `accepted` / retryable `failed` receipts on hydration, verifies the
§4.2 resume boundary still supports the pending kind, retries supported receipts
with their persisted `response` and `resumeAttemptId`, and then marks them
`applied` or `dead` under the same session lease. A legacy or drifted receipt
whose pending kind is no longer supported for idempotent resume is terminalized
with an unsupported-resume error instead of calling a non-idempotent resume
path.

`currentRun` is a session-owned inspection and recovery-coordination snapshot.
It gives `getCurrentRunId()`, override-conflict reporting, display
reconstruction, and outbox/status projection a durable pointer after hydration,
but it is not the public durability boundary for external sources. Queue replay
is still owned by `QueuedItem` / `QueueAdmissionReceipt`; channel ingress,
actions, and outbound delivery stay in their source-specific rows; accepted
signal execution and workflow snapshots stay in the agent/workflow stores.

Transient runtime state (`AbortController`, in-flight model-call promises, SSE
listeners, the live `DisplayStateScheduler`, the `pendingApprovalResolve`
callback) is **not** persisted. It's reconstructed when a record is hydrated;
pending suspensions are resumed by handing `runId`, `resumeAttemptId`, and the
persisted response payload back through the §4.2 Required Agent Resume Boundary.
The persisted `displayState` snapshot is only the JSON-safe
`HarnessDisplayStateSnapshotV1` render cache, not the scheduler, listeners,
stream iterators, internal Map/Date render model, or SSE buffer.

**Serialization contract.** Every field on `HarnessThread.metadata.app`,
`SessionRecord`, `HarnessRunOperationalState`, `ChannelBinding`,
`HarnessProviderCallbackBinding`, `ChannelInboxItem`, `ChannelOutboxItem`,
`ChannelActionToken`, and `ChannelActionReceipt` must be JSON-serializable. The
shapes above are deliberately closed: no functions, no class instances, no
`Map`/`Set`/`Date` objects (use ISO strings or epoch numbers, as shown).
Inline-form file attachments are normalised to `PersistedAttachment` references
before they reach the record. Opaque provider/workspace metadata is opaque
semantically, not a license to persist non-JSON values; providers and adapters
must normalize it to explicit `JsonValue` DTOs before the durable row is
written. The non-serialisable per-turn override (`addTools`) does not appear on
`QueuedItem` or `currentRun.toolIds` because `queue(...)` rejects it at
admission and signal-driven run snapshots store only the committed serializable
surface (`modeId`, `modelId`, `yolo`) rather than live tool closures; runs
started via `message(...)` or `useSkill(...)` with `addTools` instead record
`currentRun.nonRehydratableToolSurface = true` so recovery can fail closed
deterministically — see §4.3 and the comment on `QueuedItem` above.
Compatibility adapters for existing per-run executable tool surfaces must make
the same choice: persist stable tool identities that §5.7 can validate, or set
`nonRehydratableToolSurface`; metadata-only tool snapshots, raw tool names, and
process-local toolset/client-tool closures are not recovery evidence.

**Thread metadata extension contract.** Top-level thread metadata is not an
application write surface in v1. The harness preserves unknown top-level
metadata for legacy readers and storage adapters, but public callers can write
only nested `metadata.app` entries through `session.setThreadSetting(...)`. The
app metadata key grammar matches the storage-safe metadata-key grammar used by
current MemoryStorage adapters: start with a letter or underscore, then letters,
numbers, or underscores, maximum 128 characters, excluding `__proto__`,
`prototype`, `constructor`, and reserved Harness, Mastra, Memory, channel, or
legacy metadata names. If a legacy row already contains a non-object top-level
`app` value, public app-metadata writes fail validation rather than overwriting
that unknown value.

**`state: TState` constraint and merge semantics.** The user-defined `state`
slot is a plain JSON object whose values must round-trip through
`JSON.stringify` / `JSON.parse` without loss. The harness validates each
candidate `state` before committing a durable state mutation and rejects
non-serializable or lossy round-trip values with
`HarnessStateSerializationError`. This validation rejects `undefined`,
functions, symbols, `BigInt`, `NaN`, infinities, sparse array holes, circular
references, class instances, `Date`, `Map`, `Set`, accessors, and any other
value that is not an explicit JSON value before storage is touched; it must not
rely on `JSON.stringify` silently dropping or coercing data. The rejection is
atomic: no partial patch is persisted, and no `state_changed` event is emitted.
Adapter/save failures after successful candidate validation are
`HarnessStorageError`.

Object-form state writes (`setState(updates)`, tool-context `setState(updates)`,
`RemoteSession.setState(patch)`, and `PATCH /state`) all use the same top-level
shallow merge algorithm against the latest committed state under the session
mutation queue: omitted keys are unchanged, explicit `null` is stored as a
value, arrays replace as whole values, and nested objects replace as whole
top-level values rather than deep-merging. Object-form writes cannot delete
keys; a key with `undefined` or any non-JSON value rejects before merge/commit
rather than becoming an implicit delete. Functional `setState(prev => next)` is
the local/tool-context-only atomic read-modify-write form and commits the
updater return as a full replacement object after the same validation; it can
remove a key only by returning a complete next state object that omits that key.
Recommended: keep `state` small (rule of thumb: under 64 KiB). Large blobs
belong in workspace files, file attachments, or your own datastore — referenced
from `state` by ID.
