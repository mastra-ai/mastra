### 13.3f Error Envelope

Orientation diagram (error projection taxonomy only; the discriminated-union
TypeScript shape and prose below remain authoritative for codes, retryability,
and details schemas):

<figure>
  <svg role="img" aria-labelledby="hx-error-envelope-title hx-error-envelope-desc" viewBox="0 0 1040 580" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-error-envelope-title">Error envelope projection</title>
    <desc id="hx-error-envelope-desc">Local sources map through §4.5 typed Harness error classes to §13.3 wire codes and HTTP/SDK surfaces. Persistence and recovery codes carry retryable hints. Server-layer codes have no typed class and SDKs throw generic errors.</desc>
    <defs>
      <marker id="ah-error-envelope" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2; rx: 14;" x="40" y="28" width="260" height="50" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="60" text-anchor="middle">Local source</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2; rx: 14;" x="320" y="28" width="320" height="50" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="480" y="60" text-anchor="middle">§4.5 typed Harness*Error</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2; rx: 14;" x="660" y="28" width="340" height="50" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="60" text-anchor="middle">§13.3 wire code → HTTP / SSE / SDK</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="98" width="260" height="100" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="122" text-anchor="middle">Admission / lifecycle /</text>
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="140" text-anchor="middle">workspace / state</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="162" text-anchor="middle">busy · cap · validation · conflict</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="180" text-anchor="middle">closed / closing / not-found</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="320" y="98" width="320" height="100" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="122" text-anchor="middle">HarnessBusy · QueueFull · Validation ·</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="140" text-anchor="middle">OverrideConflict · AdmissionConflict ·</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="158" text-anchor="middle">Session{NotFound · Closed · Closing ·</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="176" text-anchor="middle">Conflict · DeleteBlocked · Locked} ·</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="194" text-anchor="middle">Workspace* · State{Serialization · Conflict}</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="660" y="98" width="340" height="100" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="122" text-anchor="middle">harness.busy / queue_full / validation</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="140" text-anchor="middle">harness.session_* · workspace_* · state_*</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="158" text-anchor="middle">→ HTTP 4xx</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="830" y="180" text-anchor="middle">retryable rarely set; SDK rehydrates</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="40" y="218" width="260" height="86" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="246" text-anchor="middle">Recovery deferral</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="268" text-anchor="middle">tool-suspension response durably</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="286" text-anchor="middle">accepted but workflow snapshot pending</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="320" y="218" width="320" height="86" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="246" text-anchor="middle">HarnessRecoveryDeferredError</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="268" text-anchor="middle">retryable: true</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="286" text-anchor="middle">same responseId on retry</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="660" y="218" width="340" height="86" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="246" text-anchor="middle">harness.recovery_deferred</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="264" text-anchor="middle">→ HTTP 503</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="830" y="286" text-anchor="middle">SDK retries with same responseId</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2; rx: 14;" x="40" y="324" width="260" height="86" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="352" text-anchor="middle">Persistence</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="374" text-anchor="middle">storage adapter failure</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="392" text-anchor="middle">corruption / parse failure</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2; rx: 14;" x="320" y="324" width="320" height="86" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="352" text-anchor="middle">HarnessStorageError</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="370" text-anchor="middle">(retryable from adapter)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="392" text-anchor="middle">HarnessSessionCorruptError</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="660" y="324" width="340" height="86" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="352" text-anchor="middle">harness.storage (retryable bool)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="370" text-anchor="middle">harness.session_corrupt</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="388" text-anchor="middle">→ HTTP 5xx</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="430" width="260" height="86" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="458" text-anchor="middle">Server-layer (transport)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="480" text-anchor="middle">auth · malformed · worker readiness</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="498" text-anchor="middle">unhandled exception</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="320" y="430" width="320" height="86" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="480" y="458" text-anchor="middle">no typed Harness subclass</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="480" y="478" text-anchor="middle">SDK throws generic Error</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="480" y="496" text-anchor="middle">with code + details</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="660" y="430" width="340" height="86" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="458" text-anchor="middle">harness.worker_unavailable (503)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="476" text-anchor="middle">harness.permission_denied · bad_request</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="830" y="494" text-anchor="middle">harness.internal</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-error-envelope);" d="M300 148 L319 148" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-error-envelope);" d="M640 148 L659 148" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-error-envelope);" d="M300 260 L319 260" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-error-envelope);" d="M640 260 L659 260" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-error-envelope);" d="M300 366 L319 366" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-error-envelope);" d="M640 366 L659 366" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-error-envelope);" d="M300 472 L319 472" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-error-envelope);" d="M640 472 L659 472" />

    <rect style="fill: #f1f5f9; stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5; rx: 12;" x="40" y="534" width="960" height="34" />
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="556">Adding a new typed Harness*Error requires adding a new code to the discriminated union; the set of codes is stable wire surface.</text>
  </svg>
  <figcaption>Every Harness-layer error projects from a local source through a typed §4.5 class to one stable §13.3 wire code with category-aligned HTTP behavior; server-layer codes have no typed class and the SDK throws a generic error.</figcaption>
</figure>

**Error envelope:**

The envelope is a discriminated union on `code`. Harness-layer codes correspond
one-to-one with typed error classes in §4.5, which owns the shared error detail
fields. The SDK rehydrates those responses into matching subclasses with the
public `details` fields populated; local implementation-only fields such as
`HarnessStorageError.cause` do not cross the wire. Server-layer codes at the end
of the union are generic transport/auth failures and are not typed Harness
subclasses. The set of codes is **stable** — adding a new code is a
wire-protocol change.

Harness v1 owns the public error projection at every Harness boundary. Current
Mastra framework errors (`MastraError`), server `HTTPException`s, Zod validation
objects, storage adapter errors, durable-agent pubsub errors, and plain
`Error`s may be preserved as local causes or diagnostic inputs, but Harness
local APIs, auto-mounted routes, result lookup DTOs, SSE/event payloads, storage
error events, and SDK promise rejections expose only matching §4.5
`Harness*Error` instances or the `HarnessPublicErrorProjection` below. Adapters
must map generic implementation failures into the typed code, `details`, and
`retryable` contract before they cross those boundaries.

```ts
type HarnessPublicErrorProjection = HarnessErrorResponse;

interface HarnessErrorResponseBase {
  message: string;                 // Human-readable. Not part of any contract;
                                   // SDK callers should branch on `code`, not `message`.
  retryable?: boolean;             // Optional advisory. Servers may set this for
                                   // transient failures (e.g. storage outages); SDKs
                                   // may use it to drive automatic retry/backoff.
}

type HarnessErrorResponse = HarnessErrorResponseBase & (
  // ── Admission failures (4xx) ────────────────────────────────────────────
  | { code: 'harness.busy';                    // → HarnessBusyError (fail-fast message/skill
                                               //   and tool-context pending-interaction conflicts)
      details: { sessionId: string;
                 reason: 'in_flight' | 'pending_approval' | 'pending_suspension' | 'pending_question' | 'pending_plan' } }
  | { code: 'harness.queue_full';              // → HarnessQueueFullError
      details: { sessionId: string; maxQueueDepth: number; currentDepth: number } }
  | { code: 'harness.validation';              // → HarnessValidationError
      details: { field: string; reason: string } }
  | { code: 'harness.output_generation_failed';// → HarnessOutputGenerationError.
                                               //   A schema-bearing sync generate path
                                               //   started but did not produce a
                                               //   successful public typed JSON value.
                                               //   This is not retry-safe in v1.
      details: { sessionId: string; runId?: string;
                 reason:
                   | 'structured_output_validation_failed'
                   | 'structured_output_missing_object'
                   | 'tripwire'
                   | 'interactive_tool_required'
                   | 'model_error' } }
  | { code: 'harness.override_conflict';       // → HarnessOverrideConflictError
      details: { sessionId: string; activeRunId: string;
                 conflictingFields: Array<'model' | 'mode' | 'addTools' | 'yolo'> } }
  | { code: 'harness.admission_conflict';      // → HarnessAdmissionConflictError
      details: { sessionId: string; admissionId: string;
                 storedAdmissionHash: string; attemptedAdmissionHash: string } }
  | { code: 'harness.attachment_in_use';       // → HarnessAttachmentInUseError
      details: { sessionId: string; attachmentId: string;
                 references: Array<{ source: string; sourceId: string }> } }
  | { code: 'harness.attachment_unavailable';  // → HarnessAttachmentUnavailableError
      details: { sessionId: string; attachmentId?: string;
                 reason:
                   | 'not_found'
                   | 'fetch_failed'
                   | 'fetch_timeout'
                   | 'too_large'
                   | 'mime_mismatch'
                   | 'digest_mismatch'
                   | 'unsupported_url'
                   | 'redirect_limit_exceeded'
                   | 'network_target_blocked'
                   | 'blocked_by_policy' } }
  | { code: 'harness.channel_action_conflict'; // → HarnessChannelActionConflictError
      details: { harnessName: string; channelId: string; actionTokenId: string; actionId: string; itemId: string } }
  | { code: 'harness.channel_binding_closed';  // → HarnessChannelBindingClosedError.
                                               //   Binding lifecycle terminal; session
                                               //   may remain active for other channels.
                                               //   Cascade closure from session close/
                                               //   delete is reported via
                                               //   harness.session_closed / harness.session_deleted,
                                               //   not this code.
      details: { harnessName: string; channelId: string; bindingId: string;
                 reason: 'platform_unlinked' | 'operator_closed' } }
  | { code: 'harness.channel_delivery_unavailable'; // → HarnessChannelDeliveryUnavailableError.
                                               //   Outbox row dead-letters because the
                                               //   stored operation/mode is no longer
                                               //   deliverable; the binding stays active.
                                               //   Not a binding closure.
      details: { harnessName: string; channelId: string;
                 outboxItemId?: string; bindingId?: string;
                 operationKind?: ChannelOutboxOperationKind;
                 operationName?: string;
                 reason: 'delivery_operation_unavailable' } }
  | { code: 'harness.inbox_item_not_found';    // → HarnessInboxItemNotFoundError
      details: { sessionId: string; itemId: string; kind?: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval' } }
  | { code: 'harness.inbox_response_conflict'; // → HarnessInboxResponseConflictError.
                                               //   Same responseId with a different response hash,
                                               //   or a different response already accepted for itemId.
      details: { sessionId: string; itemId: string; responseId: string } }
  | { code: 'harness.subagent_depth_exceeded'; // → HarnessSubagentDepthExceededError.
                                               //   Route-level error for `/sessions`
                                               //   requests whose `parentSessionId`
                                               //   would exceed `sessions.maxSubagentDepth`.
                                               //   The built-in `subagent` tool uses
                                               //   the same code/details inside a
                                               //   recoverable tool-result failure.
      details: { maxDepth: number; attemptedDepth: number } }
  | { code: 'harness.skill_not_found';         // → HarnessSkillNotFoundError
      details: { skillName: string;
                 searchedSources: Array<'code-registered' | 'workspace'> } }
  | { code: 'harness.forbidden';               // → HarnessForbiddenError.
                                               //   Principal authentication
                                               //   succeeded, but the caller
                                               //   lacks the required
                                               //   §13.2 route-principal
                                               //   capability class. Tenant/
                                               //   resource mismatches still
                                               //   use tenant-safe not-found.
      details: { capability: string; resourceId?: string; sessionId?: string } }

  // ── Session lifecycle (4xx) ─────────────────────────────────────────────
  | { code: 'harness.session_not_found';       // → HarnessSessionNotFoundError
      details: { sessionId: string } }
  | { code: 'harness.session_closed';          // → HarnessSessionClosedError
      details: { sessionId: string } }
  | { code: 'harness.session_deleted';         // → HarnessSessionDeletedError.
                                               //   Distinct from session_closed:
                                               //   the row is gone, all dependent
                                               //   rows terminalized; provider
                                               //   callbacks cannot create a new
                                               //   receipt for the same
                                               //   (harnessName, resourceId, threadId).
      details: { sessionId: string;
                 resourceId?: string;
                 threadId?: string;
                 cause?: 'cascade' | 'force' | 'tenant_delete' | 'thread_delete' } }
  | { code: 'harness.session_closing';         // → HarnessSessionClosingError
      details: { sessionId: string; closingAt: number; closeDeadlineAt: number } }
  | { code: 'harness.session_conflict';        // → HarnessSessionConflictError
      details: { resourceId: string; threadId: string;
                 requestedSessionId: string; activeSessionId: string } }
  | { code: 'harness.session_delete_blocked';  // → HarnessSessionDeleteBlockedError
      details: { sessionId: string;
                 blockers: Array<{ source:
                   | 'session'
                   | 'child_session'
                   | 'queue'
                   | 'inbox_response'
                   | 'channel_binding'
                   | 'channel_inbox'
                   | 'channel_action'
                   | 'channel_outbox'
                   | 'wakeup'
                   | 'attachment'
                   | 'workspace';
                   id?: string; status?: string }> } }
  | { code: 'harness.session_locked';          // → HarnessSessionLockedError
      details: { sessionId: string; currentOwnerId: string; expiresAt: number } }
  | { code: 'harness.live_session_limit';      // → HarnessLiveSessionLimitError
      details: { maxLive: number; liveCount: number } }
  | { code: 'harness.aborted';                 // → HarnessAbortedError
      details: { sessionId: string;
                 reason: 'agent_aborted' | 'parent_aborted' | 'session_closed' | 'process_restart';
                 parentSessionId?: string } }

  // ── Workspace (4xx) ─────────────────────────────────────────────────────
  | { code: 'harness.workspace_provider_mismatch'; // → HarnessWorkspaceProviderMismatchError
      details: { sessionId: string; storedProviderId: string; configuredProviderId: string } }
  | { code: 'harness.workspace_lost';          // → HarnessWorkspaceLostError
      details: { sessionId: string;
                 providerId?: string;
                 resourceId?: string;
                 generation?: string;
                 reason:
                   | 'restart'
                   | 'eviction'
                   | 'state_missing'
                   | 'resume_failed'
                   | 'generation_mismatch'
                   | 'provider_unavailable'
                   | 'destroyed' } }

  // ── State mutation (4xx, non-retryable) ─────────────────────────────────
  | { code: 'harness.state_serialization';     // → HarnessStateSerializationError.
                                               //   Pre-commit candidate state cannot
                                               //   round-trip as plain JSON; caller
                                               //   must change the value before retrying.
      details: { sessionId: string; path: string } }
  | { code: 'harness.state_conflict';          // → HarnessStateConflictError.
                                               //   Remote state PATCH or thread app
                                               //   metadata write used a stale
                                               //   session/state snapshot; caller
                                               //   must refetch and recompute.
      details: { sessionId: string; attemptedVersion: number; currentVersion: number } }

  // ── Recovery deferral (503, retryable) ──────────────────────────────────
  | { code: 'harness.recovery_deferred';       // → HarnessRecoveryDeferredError.
                                               //   Tool-suspension inbox response
                                               //   was durably accepted, but the
                                               //   workflow snapshot is not yet
                                               //   observable. Retry with the same
                                               //   responseId.
      retryable: true;
      details: { sessionId: string; itemId: string; responseId: string;
                 pendingKind: 'tool-suspension';
                 reason: 'workflow_snapshot_not_ready' } }

  // ── Persistence (5xx, retryability set from HarnessStorageError) ─────────
  | { code: 'harness.storage';                 // → HarnessStorageError
      retryable: boolean;
      details: {
        operation: HarnessStorageOperation;
        sessionId?: string;
        resourceId?: string;
        threadId?: string;
        harnessName?: string;
        channelId?: string;
        subject?: HarnessStorageSubject;
      } }
  | { code: 'harness.session_corrupt';         // → HarnessSessionCorruptError.
                                               //   Stored row is malformed or
                                               //   inconsistent. Runtime drift (row
                                               //   well-formed but config no longer
                                               //   matches) uses harness.runtime_drift.
      details:
        | { sessionId: string; reason: 'parse_failed' | 'schema_incompatible' }
        | { reason: 'duplicate_active_session'; resourceId: string; threadId: string; activeSessionIds: string[] }
        | { reason: 'pending_state_corrupt'; sessionId?: string; resourceId?: string; threadId?: string }
        | { reason: 'tool_surface_unrehydratable'; sessionId: string; runId?: string } }
  | { code: 'harness.runtime_drift';           // → HarnessRuntimeDriftError.
                                               //   Stored row is well-formed; current
                                               //   runtime no longer honors it
                                               //   (missing or generation-mismatched
                                               //   runtime dependency). Background-task
                                               //   rows without an owning session use
                                               //   `runId` / `backgroundTaskId`
                                               //   instead of `sessionId`.
      details: { sessionId?: string;
                 runId?: string;
                 backgroundTaskId?: string;
                 missingRefs?: Array<{
                   kind:
                     | 'mode' | 'agent' | 'model' | 'tool' | 'mcp_binding'
                     | 'workspace_provider' | 'executor' | 'completion_policy'
                     | 'sandbox_policy' | 'channel';
                   ref: string }>;
                 driftedRefs?: Array<{
                   kind:
                     | 'mode' | 'agent' | 'model' | 'tool' | 'mcp_binding'
                     | 'workspace_provider' | 'executor' | 'completion_policy'
                     | 'sandbox_policy' | 'channel';
                   ref: string;
                   expectedGeneration?: string;
                   actualGeneration?: string }> } }

  // ── Server-layer (no typed class; SDK throws a generic Error) ───────────
  | { code: 'harness.worker_unavailable';      // HTTP 503 readiness or drain refusal for a durable worker scope.
                                               // Not a typed Harness subclass; clients may retry with backoff.
                                               // `reason: 'server_draining'` signals pre-`mastra.shutdown()`
                                               // drain refusal, so callers retry against the next instance
                                               // rather than the same one (§13.6).
      retryable: true;
      details: {
        harnessName: string;
        channelId?: string;
        source?: string;                       // Wakeup/scheduler/proactive source, when the scope has one.
        scope: 'channel_inbox' | 'channel_action' | 'channel_outbox' | 'wakeup' | 'background_task';
        reason:
          | 'worker_not_started'
          | 'worker_unhealthy'
          | 'storage_unreachable'
          | 'registry_invalid'
          | 'provider_restore_incomplete'
          | 'runtime_config_invalid'
          | 'server_draining';
      } }
  | { code: 'harness.permission_denied';       // Transport-level auth boundary
                                               // failure before a Harness
                                               // principal/capability can be
                                               // proven. Capability failures
                                               // for known principals use
                                               // harness.forbidden; tenant or
                                               // resource mismatches use
                                               // tenant-safe not-found.
      details?: { reason?: string } }
  | { code: 'harness.bad_request';             // Malformed HTTP request (bad JSON, missing route param).
                                               // Distinct from `harness.validation`, which is harness-layer
                                               // admission for well-formed requests.
      details?: Record<string, unknown> }
  | { code: 'harness.internal';                // Catch-all for unhandled server exceptions.
      details?: { traceId?: string } }
);
```

The `details` field on a response is typed by the discriminated `code`; SDK
rehydration is a switch on `code`. For Harness-layer codes, the switch constructs
the matching `Harness*Error` subclass with the corresponding fields. For generic
server-layer codes, the SDK throws a generic protocol/auth/internal error. Adding
a new typed Harness error class requires adding a new Harness-layer code to this
union.

#### 13.3f.1 Row-error projection mapping

Storage rows record bare `HarnessRowErrorCode` values (§4.5d) in `lastError.code`,
row `error.code`, `closedReason`, and `revokedReason` fields. **Bare codes MUST
NOT cross the v1 wire.** Every public DTO and event payload that surfaces a row's
error cause MUST project the bare `HarnessRowErrorCode` through the table below
into a fully-namespaced `HarnessErrorResponse` envelope before the value is
serialized into an HTTP response body, an SSE `data:` payload, an `error`
`TurnEvent`, or any other §13.3 surface. Internal storage adapters, recovery
workers, and §5.x prose write the bare form; §13.x routes, §10.x events, and
§4.x route handlers emit the namespaced envelope.

| `HarnessRowErrorCode`              | `HarnessErrorResponse.code`         | `details.reason`                          |
| ---------------------------------- | ----------------------------------- | ----------------------------------------- |
| `session_closed`                   | `harness.session_closed`            | — (envelope is sufficient)                |
| `session_closing`                  | `harness.session_closing`           | — (envelope is sufficient)                |
| `session_deleted`                  | `harness.session_deleted`           | — (envelope is sufficient; `details.cause` carries delete origin when known) |
| `platform_unlinked`                | `harness.channel_binding_closed`    | `platform_unlinked`                       |
| `operator_closed`                  | `harness.channel_binding_closed`    | `operator_closed`                         |
| `delivery_operation_unavailable`   | `harness.channel_delivery_unavailable` | `delivery_operation_unavailable`       |
| `pending_state_corrupt`            | `harness.session_corrupt`           | `pending_state_corrupt`                   |
| `tool_surface_unrehydratable`      | `harness.session_corrupt`           | `tool_surface_unrehydratable`             |
| `runtime_dependency_drifted`       | `harness.runtime_drift`             | — (envelope is sufficient; `details.missingRefs` / `driftedRefs` carry the drift surface when known) |
| `live_session_limit`               | `harness.live_session_limit`        | — (envelope is sufficient)                |

The mapping is a total function from `HarnessRowErrorCode` onto
`HarnessErrorResponse.code`. Two rules follow:

1. **Wire-side strictness.** A §13.x route, SSE `data:` payload, or `error`
   `TurnEvent` that surfaces a row's cause without applying this mapping is a
   contract violation. The wire never sees `'session_deleted'`,
   `'delivery_operation_unavailable'`, `'tool_surface_unrehydratable'`,
   `'runtime_dependency_drifted'`, or any other bare `HarnessRowErrorCode`
   literal as a top-level `error.code`. Row-shape DTOs like `SessionListItem`
   and `DurableWorkSummary` carry bare `lastError.code` internally but their
   §13.x public projections rewrite that field through this table before the
   DTO leaves the server.
2. **Row-side readability.** Storage rows keep the bare cause for inline
   readability and to avoid renaming existing inline literal unions on
   `ChannelBinding.closedReason` (§5.1h) and parallel sites. Renaming row codes
   to `harness.*` would still require this mapping step because several rows
   collapse to a shared envelope (`pending_state_corrupt`,
   `tool_surface_unrehydratable` → `harness.session_corrupt` with discriminating
   `details.reason`); namespacing rows would not eliminate the projection
   surface, only its visibility.

Current Mastra emits legacy `HarnessEvent` shapes that do not yet honor this
contract. The §11.6a compatibility-input projector for legacy `HarnessEvent`
(`packages/core/src/harness/types.ts:704-735`) is the v1 boundary: legacy bare
codes enter the projector, the projector applies the §13.3f.1 mapping, and
v1 SDK consumers observe only namespaced envelopes. Unknown legacy strings
project to `harness.internal` with the legacy string preserved on
`details.legacyCode` so the projector fails safe rather than silently dropping
unmodelled inputs.
