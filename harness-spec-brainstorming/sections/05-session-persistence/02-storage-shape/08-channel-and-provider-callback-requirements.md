### 5.2h Channel and Provider Callback Requirements

Channel storage requirements: active `ChannelBinding` rows are unique by
`(harnessName, channelId, platform, externalTenantId, externalChannelId, externalThreadId)`
with missing optional external IDs normalised to a sentinel before indexing;
replacement or closure for the same external tuple increments `generation` only
when a new active binding is created and leaves previous rows non-active
(`replaced` or `closed`); `(harnessName, channelId, idempotencyKey)` is unique
for `ChannelInboxItem`; `(harnessName, channelId, actionTokenId)` is unique for
`ChannelActionToken` and `ChannelActionReceipt`;
`(harnessName, channelId, transportHash)` is unique for `ChannelActionToken`
when the rendered token string is not self-decoding;
`(harnessName, bindingId, bindingGeneration, owningSessionId, itemId, kind, runId, pendingRequestedAt, metadataHash)`
is unique for `ChannelActionToken`; `(harnessName, channelId, actionId)` is
indexed for provider retry lookup but is not sufficient as the first-response
guard; `(harnessName, bindingId, idempotencyKey)` is unique for
`ChannelOutboxItem`; `resolveChannelBinding` must atomically create one active
binding or return the existing active binding for the external conversation;
`createOrLoadChannelInboxItem`, `createOrLoadChannelActionToken`, and
`createOrLoadChannelActionReceipt` must be atomic insert-or-load operations
backed by a unique constraint plus transaction/upsert/CAS equivalent. They
return exact duplicates and flag same-key/different-hash conflicts without
overwriting the first record. For action tokens, same-key means the
deterministic pending prompt identity (`bindingId`, `bindingGeneration`,
`resourceId`, `owningSessionId`, `itemId`, `kind`, `runId`,
`pendingRequestedAt`, canonical JSON `audience`, `providerId`, and
`metadataHash`); a same pending prompt under the same binding generation with
different immutable metadata, audience snapshot, transport hash, expiry, or key
profile is a projection conflict unless an explicit operator migration revokes
the old token and creates a new prompt under a replacement binding. Token rows
are non-claimable lookup/projection records: revocation updates only
`revokedAt`, `revokedReason`, and `updatedAt`, and storage-authoritative time is
preferred when the caller omits `revokedAt`. For action receipts, same-key means
`actionTokenId`: an exact duplicate has the same token metadata (`bindingId`,
`bindingGeneration`, `resourceId`, `owningSessionId`, `itemId`, `kind`, `runId`,
`pendingRequestedAt`, canonical JSON `audience`) and `responseHash`; a
same-token mismatch in either immutable token metadata or response hash is a
conflict even when the provider supplied a different `actionId`. The winning
receipt snapshots the authorized `verifiedActor` for audit, but a later callback
never overwrites it. For outbox items, exact duplicate enqueue has the same
`payloadHash`, `operationKind`, `operationName` (including absence), and
`deliverySemantics`; same `(harnessName, bindingId, idempotencyKey)` with a
different `payloadHash`, operation identity, or delivery semantics mode is a
conflict. `markChannelOutboxSent` records `sentAt`, `providerMessageId` when
available, and adapter-normalized `providerReceipt` metadata under the current
claim; storage-authoritative time is preferred when the caller omits `sentAt`.

Provider callback binding storage requirements: active
`HarnessProviderCallbackBinding` rows are unique by `(providerId, selectorKind,
selectorValue)` across the provider-callback namespace of the physical
deployment. These rows still persist `harnessName` and `channelId`, and every
loaded row is validated against the registered target before use, but selector
lookup happens before the registry knows the target Harness. Therefore
`loadProviderCallbackBindingBySelector(...)` returns only the single active row
for that selector, or `null`; `providerId`-only lookup is never a routing
primitive.

Exact duplicate (`providerId + selector` and same `harnessName + channelId +
origin`) returns the existing row. Same-key with a different `harnessName`,
`channelId`, or `origin` target is a provisioning conflict and returns the
existing binding with `conflict: true`; the candidate never overwrites the
stored active target. `resolveProviderCallbackBinding(...)` must be atomic
insert-or-load backed by a unique constraint plus transaction/upsert/CAS
equivalent; separate save-then-lookup paths must not be used for routing
decisions. When `replaceBindingId` is present, the same atomic operation must
create the new active binding, set the previous row to `status: 'replaced'`,
record `replacedByBindingId` on the previous row, and return
`replacedBindingId`. A replacement whose previous row is missing, not active,
or owns a different selector is a provisioning conflict.

If the stored `harnessName` or `channelId` is no longer registered, the binding
is marked `undeliverable` at init or at callback time through
`markProviderCallbackBindingStatus(...)` rather than being deleted or silently
retargeting. Multiple callback bindings per provider (one per selector) are
valid; two active bindings for the same selector pointing at different
harness/channel pairs is a conflict at provisioning time. `selectorValue` is the
adapter-normalized canonical key for the selector kind: `installation` stores
the trusted `installationId`; `route-key` stores the trusted `routeKey`;
`external-tenant` stores a collision-free canonical tuple of
`externalTenantId` plus a sentinel-normalized `externalChannelId` so a missing
optional channel ID cannot alias a different installation on the same external
tenant. Storage adapters must enforce this normalization at write time and must
not rely on SQL `NULL` uniqueness, mirroring the §14.1 `ChannelBinding` rule.
An `undeliverable` row may transition back to `active` through
`markProviderCallbackBindingStatus(...)` only when the stored `harnessName` and
`channelId` are again registered and no other active binding owns the same
`(providerId, selectorKind, selectorValue)`. A `disabled` row may be manually
reactivated through the same method only with that uniqueness and registration
check. `replaced` is terminal; it does not auto-revive at init and cannot be
made active again. Repeating `markProviderCallbackBindingStatus(...)` with the
current status is idempotent.
Cross-deployment isolation when a single storage backend is shared between
distinct Mastra deployments is HC-045's storage-namespace concern, not part
of the callback binding key.
