### 4.5d Storage, State, Workspace, and Lock Errors

```ts
// Row-level cause codes durable storage rows record in `lastError.code` /
// `error.code` / `closedReason` / `revokedReason` fields. These are the
// internal bare causes; v1 wire surfaces and `error` events MUST project
// them through §13.3f.1 into a namespaced `HarnessErrorResponse` envelope
// before crossing the wire. Bare codes never appear in `HarnessEventError`
// payloads or §13.3f error responses.
type HarnessRowErrorCode =
  // Lifecycle / cascade closure
  | 'session_closed'
  | 'session_closing'
  | 'session_deleted'
  // Channel-binding closure (binding lifecycle terminal, session may stay
  // active for other channels and direct work)
  | 'platform_unlinked'
  | 'operator_closed'
  // Outbox dispatch dead-letter (binding stays active; per-row failure)
  | 'delivery_operation_unavailable'
  // Hydration / corruption / drift failure modes
  | 'pending_state_corrupt'
  | 'tool_surface_unrehydratable'
  | 'runtime_dependency_drifted'
  // Admission caps
  | 'live_session_limit';

// Persistence — see §5.7. Operation labels are logical storage surfaces, not
// one label per adapter method; they are mirrored by `storage_error` events and
// wire `harness.storage` responses.
type HarnessStorageOperation =
  | 'session_create'
  | 'session_load'
  | 'session_save'
  | 'session_list'
  | 'session_close'
  | 'session_delete'
  | 'session_delete_cleanup'
  | 'session_lease_acquire'
  | 'session_lease_renew'
  | 'session_lease_release'
  | 'thread'
  | 'thread_metadata'
  | 'message_log'
  | 'queue'
  | 'operation_tombstone'
  | 'inbox_response'
  | 'channel_binding'
  | 'provider_callback_binding'
  | 'channel_inbox'
  | 'channel_action'
  | 'channel_outbox'
  | 'wakeup'
  | 'attachment'
  | 'workspace_cleanup';

type HarnessStorageSubject =
  | { kind: 'session'; id: string }
  | { kind: 'thread'; id: string }
  | { kind: 'message'; id: string }
  | { kind: 'queued_item'; id: string }
  | { kind: 'operation_tombstone'; id: string }
  | { kind: 'inbox_response'; id: string }
  | { kind: 'channel_binding'; id: string }
  | { kind: 'provider_callback_binding'; id: string }
  | { kind: 'channel_inbox'; id: string }
  | { kind: 'channel_action'; id: string }
  | { kind: 'channel_outbox'; id: string }
  | { kind: 'wakeup'; id: string }
  | { kind: 'attachment'; id: string }
  | { kind: 'workspace'; id: string };

class HarnessStorageError extends Error {
  readonly operation: HarnessStorageOperation;
  // Present when the failing operation is scoped to a known, tenant-checked
  // session/thread/channel route. Harness-scoped worker or registry failures
  // can omit these instead of inventing placeholder IDs.
  readonly sessionId?: string;
  readonly resourceId?: string;
  readonly threadId?: string;
  readonly harnessName?: string;
  readonly channelId?: string;
  // Present when the failing storage row was already known and safe to expose
  // to the current principal/operator. Do not fill this from untrusted provider
  // payloads or for cross-resource rows hidden by tenant-safe not-found rules.
  readonly subject?: HarnessStorageSubject;
  readonly retryable: boolean;
  // Local implementation cause; never crosses the wire (§13.3).
  readonly cause: unknown;
}

class HarnessSessionCorruptError extends Error {
  readonly sessionId?: string;
  readonly resourceId?: string;
  readonly threadId?: string;
  readonly activeSessionIds?: string[];
  readonly reason:
    | 'parse_failed'
    | 'schema_incompatible'
    | 'duplicate_active_session'
    | 'pending_state_corrupt';
}

// State serialization — see §5.1. Thrown before any durable state commit when
// a candidate `state` cannot round-trip through `JSON.stringify` /
// `JSON.parse` as plain JSON. This is a non-retryable state-shape failure, not
// a storage failure; adapter/save failures after validation use
// `HarnessStorageError`.
class HarnessStateSerializationError extends Error {
  readonly sessionId: string;
  readonly path: string;          // dotted path into `state`, or `$` for root
}

// Remote state PATCH — see §13.2. Thrown before durable state commit when the
// client's `If-Match` validator no longer matches the stored
// `SessionRecord.version`. Non-retryable as-is: the caller must refetch state
// and recompute the patch.
class HarnessStateConflictError extends Error {
  readonly sessionId: string;
  readonly attemptedVersion: number;
  readonly currentVersion: number;
}

// Workspace provider — see §2.7, §9.
class HarnessConfigError extends Error {
  readonly field: string;         // e.g. 'workspace.provider'
  readonly reason: string;        // e.g. 'provider "X" is not resumable'
}

class HarnessWorkspaceProviderMismatchError extends Error {
  readonly sessionId: string;
  readonly storedProviderId: string;
  readonly configuredProviderId: string;
}

class HarnessWorkspaceLostError extends Error {
  readonly sessionId: string;
  readonly providerId?: string;   // present for per-session providers when known
  readonly resourceId?: string;   // present for per-resource/external workspace loss
  readonly generation?: string;
  readonly reason:
    | 'restart'
    | 'eviction'
    | 'state_missing'
    | 'resume_failed'
    | 'generation_mismatch'
    | 'provider_unavailable'
    | 'destroyed';
}

class HarnessResourceWorkspaceInUseError extends Error {
  readonly resourceId: string;
  readonly activeSessionIds?: string[];
}

// Write-concurrency — see §5.8.
class HarnessSessionLockedError extends Error {
  readonly sessionId: string;
  readonly currentOwnerId: string;
  readonly expiresAt: number;     // epoch ms — advisory only; storage time and
                                  // competing claimants decide whether a later
                                  // retry can acquire the lease.
}
```
