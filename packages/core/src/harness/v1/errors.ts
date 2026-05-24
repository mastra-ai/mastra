/**
 * Harness v1 — error taxonomy.
 *
 * One file for the whole catalog. Every error name maps 1:1 to a wire code
 * in the discriminated `HarnessErrorResponse` union (§13.2). See HARNESS_V1_SPEC.md
 * §4.5 for the complete list and rationale; this file currently carries the
 * subset needed by lifecycle/resolver code, and grows as the rest of the
 * surface lands.
 */

/**
 * Misconfiguration detected at `new Harness(config)`. Examples: a `HarnessMode`
 * references an unknown agent id; both `tools` and `additionalTools` set on
 * the same mode; `defaultModeId` does not match any mode.
 */
export class HarnessConfigError extends Error {
  readonly name = 'HarnessConfigError';
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`HarnessConfigError at ${field}: ${reason}`);
  }
}

export type HarnessRuntimeDependencyKind = 'mode' | 'agent' | 'workspace_provider' | 'runtime_compatibility_generation';

export class HarnessRuntimeDependencyDriftError extends Error {
  readonly name = 'HarnessRuntimeDependencyDriftError';
  readonly code = 'harness.runtime_dependency_drifted';

  constructor(
    public readonly dependencyKind: HarnessRuntimeDependencyKind,
    public readonly dependencyId: string,
    public readonly reason: string,
    public readonly context?: string,
  ) {
    super(
      `Runtime dependency drifted${context ? ` during ${context}` : ''}: ${dependencyKind} "${dependencyId}" ${reason}`,
    );
  }
}

/**
 * `harness.session({ sessionId })` could not find a record, or `{ sessionId,
 * resourceId }` found one whose `resourceId` did not match. Existence across
 * tenants is never leaked — a foreign-owned session surfaces as not-found.
 */
export class HarnessSessionNotFoundError extends Error {
  readonly name = 'HarnessSessionNotFoundError';
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" not found`);
  }
}

/**
 * Direct ID lookup of a closed session. Threads can be reused (`{ threadId,
 * resourceId }` ignores closed records and creates fresh), but ID lookups of
 * closed records always fail loudly.
 */
export class HarnessSessionClosedError extends Error {
  readonly name = 'HarnessSessionClosedError';
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" is closed`);
  }
}

/**
 * The session has entered the durable closing phase. The record still
 * occupies its active `(harnessName, resourceId, threadId)` key while close
 * aborts/drains live work and cascades through descendants, but callers must
 * not start new work or mutate session state.
 */
export class HarnessSessionClosingError extends Error {
  readonly name = 'HarnessSessionClosingError';
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" is closing`);
  }
}

/**
 * Raised when a queued turn promise is rejected because the session
 * (or that specific queued item) was cancelled before the turn ran.
 * Carries the durable cancellation `reason` when one was supplied.
 */
export class HarnessSessionCancelledError extends Error {
  readonly name = 'HarnessSessionCancelledError';
  constructor(
    public readonly sessionId: string,
    public readonly reason?: string,
  ) {
    super(reason ? `Session "${sessionId}" cancelled: ${reason}` : `Session "${sessionId}" cancelled`);
  }
}

export class HarnessSessionDeleteBlockedError extends Error {
  readonly name = 'HarnessSessionDeleteBlockedError';
  constructor(
    public readonly sessionId: string,
    public readonly blockers: ReadonlyArray<string>,
  ) {
    super(`Session "${sessionId}" cannot be deleted: ${blockers.join(', ')}`);
  }
}

export class HarnessSessionDeletedError extends Error {
  readonly name = 'HarnessSessionDeletedError';
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" is deleted`);
  }
}

/**
 * `harness.session(...)` could not acquire the session's write lease under
 * `lockMode: 'fail'`. Carries the current owner so callers can route the
 * request to the holding instance, and the TTL so callers can decide whether
 * to back off and retry. See §5.8.
 */
export class HarnessSessionLockedError extends Error {
  readonly name = 'HarnessSessionLockedError';
  constructor(
    public readonly sessionId: string,
    public readonly currentOwnerId: string,
    public readonly expiresAt: number,
  ) {
    super(`Session "${sessionId}" is locked by owner "${currentOwnerId}" until ${new Date(expiresAt).toISOString()}`);
  }
}

/**
 * Caller passed an option that violates a runtime contract — e.g.
 * `respondToToolApproval` while no `tool-approval` is pending, or while a
 * different `kind` of resume is pending. Throws synchronously before any
 * agent or storage work happens.
 */
export class HarnessValidationError extends Error {
  readonly name = 'HarnessValidationError';
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`HarnessValidationError at ${field}: ${reason}`);
  }
}

/**
 * Internal error thrown by `Session._callJudge(...)` when a judge model
 * invocation fails. The `kind` discriminator drives the goal-loop's
 * recovery behavior — `'timeout'` is retried once with backoff,
 * `'provider_error'` and `'invalid_verdict'` are terminal. Classified
 * inside `_callJudge` so `_runGoalJudge` can map directly to a paused
 * reason and stamp `GoalState.lastFailure`.
 *
 * Not part of the public Harness API surface — consumers observe failures
 * via the `goal_paused` event and `GoalState.lastFailure`.
 */
export type HarnessGoalJudgeFailureKind = 'timeout' | 'provider_error' | 'invalid_verdict';

export class HarnessGoalJudgeFailedError extends Error {
  readonly name = 'HarnessGoalJudgeFailedError';
  constructor(
    public readonly kind: HarnessGoalJudgeFailureKind,
    message?: string,
  ) {
    super(message ?? `Goal judge invocation failed (${kind})`);
  }
}

/**
 * `session.queue(...)` rejected at admission because `pendingQueue` has
 * already reached `sessions.maxQueueDepth` (default 100). The capacity check
 * and durable append are atomic per session, so two concurrent `queue()`
 * calls cannot both observe available space and commit past the cap.
 */
export class HarnessQueueFullError extends Error {
  readonly name = 'HarnessQueueFullError';
  constructor(
    public readonly sessionId: string,
    public readonly maxQueueDepth: number,
  ) {
    super(`Queue for session "${sessionId}" is full (max ${maxQueueDepth})`);
  }
}

export class HarnessAdmissionConflictError extends Error {
  readonly name = 'HarnessAdmissionConflictError';
  constructor(
    public readonly sessionId: string,
    public readonly admissionId: string,
    public readonly storedAdmissionHash: string,
    public readonly attemptedAdmissionHash: string,
  ) {
    super(`Admission "${admissionId}" for session "${sessionId}" conflicts with stored evidence`);
  }
}

export class HarnessInboxItemNotFoundError extends Error {
  readonly name = 'HarnessInboxItemNotFoundError';
  constructor(
    public readonly sessionId: string,
    public readonly itemId: string,
  ) {
    super(`Inbox item "${itemId}" for session "${sessionId}" was not found`);
  }
}

export class HarnessInboxResponseConflictError extends Error {
  readonly name = 'HarnessInboxResponseConflictError';
  constructor(
    public readonly sessionId: string,
    public readonly itemId: string,
    public readonly responseId: string,
  ) {
    super(
      `Inbox response "${responseId}" for item "${itemId}" on session "${sessionId}" conflicts with stored evidence`,
    );
  }
}

export class HarnessStateConflictError extends Error {
  readonly name = 'HarnessStateConflictError';
  constructor(
    public readonly sessionId: string,
    public readonly attemptedVersion: number,
    public readonly currentVersion: number,
  ) {
    super(`State update for session "${sessionId}" expected version ${attemptedVersion} but found ${currentVersion}`);
  }
}

export class HarnessAttachmentInUseError extends Error {
  readonly name = 'HarnessAttachmentInUseError';
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
    public readonly references: ReadonlyArray<{ source: string; sourceId: string; retainedUntil?: number }>,
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" is still in use`);
  }
}

export type HarnessAttachmentUnavailableReason =
  | 'not_found'
  | 'digest_mismatch'
  | 'bytes_mismatch'
  | 'unsupported_url'
  | 'redirect_limit_exceeded'
  | 'network_target_blocked'
  | 'fetch_timeout'
  | 'too_large'
  | 'mime_mismatch'
  | 'blocked_by_policy';

export class HarnessAttachmentUnavailableError extends Error {
  readonly name = 'HarnessAttachmentUnavailableError';
  constructor(
    public readonly sessionId: string,
    public readonly reason: HarnessAttachmentUnavailableReason,
    public readonly attachmentId?: string,
  ) {
    super(`Attachment${attachmentId ? ` "${attachmentId}"` : ''} for session "${sessionId}" is unavailable: ${reason}`);
  }
}

/**
 * `spawn_subagent` called from a session whose `subagentDepth` is at or
 * above `HarnessConfig.subagents.maxDepth`. Surfaces as a tool error
 * payload (not a thrown exception) so the parent agent can recover and
 * continue without aborting the whole turn.
 */
export class HarnessSubagentDepthExceededError extends Error {
  readonly name = 'HarnessSubagentDepthExceededError';
  constructor(
    public readonly sessionId: string,
    public readonly depth: number,
    public readonly maxDepth: number,
  ) {
    super(`Session "${sessionId}" cannot spawn a subagent: depth ${depth} ≥ maxDepth ${maxDepth}`);
  }
}

/**
 * Durable write rejected by the storage adapter — exhausted the harness's
 * one transparent retry. `cause` carries the underlying storage error.
 */
export class HarnessStorageError extends Error {
  readonly name = 'HarnessStorageError';
  constructor(
    public readonly sessionId: string,
    public readonly operation: 'flush' | 'load' | 'attachment',
    public readonly cause: unknown,
  ) {
    super(`Harness storage ${operation} failed for session "${sessionId}"`);
  }
}

/**
 * Thread CRUD operation targeted a thread that does not exist, or that
 * belongs to a different resource than the caller. Cross-resource existence
 * is never leaked — both cases produce the same error.
 */
export class HarnessThreadNotFoundError extends Error {
  readonly name = 'HarnessThreadNotFoundError';
  constructor(
    public readonly resourceId: string,
    public readonly threadId: string,
  ) {
    super(`Thread "${threadId}" not found for resource "${resourceId}"`);
  }
}

/**
 * `harness.models.*` lookup targeted a `modelId` that is not present in
 * the configured catalog ({@link HarnessConfigCommon.models}). Catalog
 * membership is a hard precondition so typos surface immediately rather
 * than silently resolving to `'unknown'` auth status.
 */
export class HarnessModelNotFoundError extends Error {
  readonly name = 'HarnessModelNotFoundError';
  constructor(public readonly modelId: string) {
    super(`Model "${modelId}" is not present in the harness model catalog`);
  }
}

/**
 * `session.skills.use(ref)` could not resolve `ref` in the session's skill
 * catalogues. `searchedSources` reports which catalogues were available for
 * lookup before giving up. See spec §4.6.
 */
export class HarnessSkillNotFoundError extends Error {
  readonly name = 'HarnessSkillNotFoundError';
  constructor(
    public readonly skillName: string,
    public readonly searchedSources: ReadonlyArray<'code-registered' | 'workspace'>,
  ) {
    super(`Skill "${skillName}" not found (searched: ${searchedSources.join(', ') || 'none'})`);
  }
}

/**
 * `session.skills.use(ref, { args })` failed args validation against the
 * resolved skill's declared schema. See spec §4.6.
 */
export class HarnessSkillArgsValidationError extends Error {
  readonly name = 'HarnessSkillArgsValidationError';
  constructor(
    public readonly skillName: string,
    public readonly issues: ReadonlyArray<string>,
  ) {
    super(`Skill "${skillName}" args invalid: ${issues.join('; ')}`);
  }
}

/**
 * A per-turn override (e.g. `mode`, `additionalTools`, `prepareStep`) was supplied on a
 * signal that drains into an already-active run. The active run's surface
 * (model/mode/toolset) was committed when the run started and cannot be
 * changed mid-flight; silently ignoring the override would be a footgun,
 * so the harness rejects at admission. See spec §4.2.
 */
export class HarnessOverrideConflictError extends Error {
  readonly name = 'HarnessOverrideConflictError';
  constructor(
    public readonly sessionId: string,
    public readonly field: 'mode' | 'additionalTools' | 'model' | 'prepareStep',
    public readonly reason: string,
  ) {
    super(`HarnessOverrideConflictError on session "${sessionId}" for "${field}": ${reason}`);
  }
}

/**
 * A harness-event publish path received a payload that is not
 * JSON-serializable. The check runs synchronously before any subscriber
 * observes the event, so in-process listeners and remote/SSE subscribers
 * see the same contract.
 *
 * `path` is the dotted location of the offending value (e.g. `event.foo.bar`).
 * `reason` is a typed description of why the value was rejected.
 */
export type EventSerializationReason =
  | 'function'
  | 'symbol'
  | 'bigint'
  | 'undefined'
  | 'class-instance'
  | 'map'
  | 'set'
  | 'date'
  | 'typed-array'
  | 'cyclic'
  | 'unknown';

export class HarnessEventSerializationError extends Error {
  readonly name = 'HarnessEventSerializationError';
  constructor(
    public readonly sessionId: string | undefined,
    public readonly eventType: string,
    public readonly path: string,
    public readonly reason: EventSerializationReason,
  ) {
    super(
      `Event "${eventType}" is not JSON-serializable at ${path}: ${reason}` +
        (sessionId ? ` (session: ${sessionId})` : ''),
    );
  }
}

/**
 * Stored `SessionRecord.workspace.providerId` does not match the harness's
 * configured workspace provider. Common when redeploying with a different
 * provider. The harness refuses to rehydrate the record rather than hand it
 * to the wrong implementation. See §2.7.
 */
export class HarnessWorkspaceProviderMismatchError extends Error {
  readonly name = 'HarnessWorkspaceProviderMismatchError';
  constructor(
    public readonly sessionId: string,
    public readonly expectedProviderId: string,
    public readonly storedProviderId: string,
  ) {
    super(
      `Workspace provider mismatch for session "${sessionId}": stored "${storedProviderId}", configured "${expectedProviderId}"`,
    );
  }
}

/**
 * A `per-session` workspace backed by a non-resumable provider could not be
 * recovered after a process restart. The next tool call provisions a fresh
 * workspace; pending tool calls captured by the previous process are
 * surfaced with this error so callers can decide what to do. See §2.7.
 */
export class HarnessWorkspaceLostError extends Error {
  readonly name = 'HarnessWorkspaceLostError';
  constructor(
    public readonly sessionId: string,
    public readonly providerId: string,
    public readonly reason: 'non-resumable-restart' | 'missing-state' = 'non-resumable-restart',
  ) {
    super(`Workspace for session "${sessionId}" (provider "${providerId}") was lost: ${reason}`);
  }
}

/**
 * `provider.create` / `provider.resume` threw. Wraps the underlying cause and
 * marks the failure with the originating session/resource ids.
 */
export class HarnessWorkspaceProvisioningError extends Error {
  readonly name = 'HarnessWorkspaceProvisioningError';
  constructor(
    public readonly providerId: string,
    public readonly cause: unknown,
    public readonly sessionId?: string,
    public readonly resourceId?: string,
  ) {
    super(
      `Failed to provision workspace via provider "${providerId}": ` +
        (cause instanceof Error ? cause.message : String(cause)),
    );
  }
}

/**
 * `harness.destroyResourceWorkspace({ resourceId })` was called while sessions
 * still hold the workspace (refcount > 0). Callers are expected to close those
 * sessions first.
 */
export class HarnessWorkspaceInUseError extends Error {
  readonly name = 'HarnessWorkspaceInUseError';
  constructor(
    public readonly resourceId: string,
    public readonly refCount: number,
  ) {
    super(`Workspace for resource "${resourceId}" is in use (refCount: ${refCount})`);
  }
}

/**
 * Replay/list/get/version artifact APIs were called against a storage
 * adapter that does not implement the artifact substrate
 * (`HarnessStorageCapabilities.harnessArtifacts === false`).
 */
export class HarnessArtifactsUnsupportedError extends Error {
  readonly name = 'HarnessArtifactsUnsupportedError';
  readonly code = 'harness.artifacts_unsupported';
  constructor(public readonly api: string) {
    super(`${api}: artifact substrate is not supported by this storage adapter`);
  }
}

/**
 * The named artifact does not exist on the target `(sessionId, resourceId)`.
 */
export class HarnessArtifactNotFoundError extends Error {
  readonly name = 'HarnessArtifactNotFoundError';
  readonly code = 'harness.artifact_not_found';
  constructor(public readonly artifactId: string) {
    super(`Artifact "${artifactId}" not found`);
  }
}

/**
 * `harness.artifacts.write({ parentArtifactId })` referenced a parent
 * artifact that does not exist in the target scope, or that lives in a
 * different `(sessionId, resourceId)`.
 */
export class HarnessArtifactLineageMismatchError extends Error {
  readonly name = 'HarnessArtifactLineageMismatchError';
  readonly code = 'harness.artifact_lineage_mismatch';
  constructor(
    public readonly parentArtifactId: string,
    public readonly reason: 'parent_missing' | 'parent_wrong_session' | 'parent_wrong_resource',
  ) {
    super(`Artifact lineage mismatch on parent "${parentArtifactId}": ${reason}`);
  }
}

/**
 * Two concurrent `harness.artifacts.write({ parentArtifactId })` calls
 * raced for the same next-version slot on a lineage. The losing caller
 * should retry against the latest version of the lineage.
 */
export class HarnessArtifactVersionConflictError extends Error {
  readonly name = 'HarnessArtifactVersionConflictError';
  readonly code = 'harness.artifact_version_conflict';
  constructor(
    public readonly lineageRootId: string,
    public readonly version: number,
  ) {
    super(`Artifact version ${version} for lineage "${lineageRootId}" already exists`);
  }
}

/**
 * `harness.artifacts.write({ artifactId })` collided with an existing
 * artifact id. Artifact ids are caller-supplied and immutable.
 */
export class HarnessArtifactDuplicateIdError extends Error {
  readonly name = 'HarnessArtifactDuplicateIdError';
  readonly code = 'harness.artifact_duplicate_id';
  constructor(public readonly artifactId: string) {
    super(`Artifact "${artifactId}" already exists`);
  }
}

/**
 * `harness.artifacts.write({ attachmentId })` referenced an attachment
 * that has not been uploaded on this session.
 */
export class HarnessArtifactAttachmentMissingError extends Error {
  readonly name = 'HarnessArtifactAttachmentMissingError';
  readonly code = 'harness.artifact_attachment_missing';
  constructor(public readonly attachmentId: string) {
    super(`Artifact references attachment "${attachmentId}" which does not exist on this session`);
  }
}

/**
 * `harness.permissions.applyProfile({ profileName })` was called with a
 * profile name that is not registered in the harness preset map.
 */
export class HarnessPermissionProfileNotFoundError extends Error {
  readonly name = 'HarnessPermissionProfileNotFoundError';
  readonly code = 'harness.permission_profile_not_found';
  constructor(public readonly profileName: string) {
    super(`Permission profile "${profileName}" is not registered`);
  }
}

/**
 * Replay-aware Session/Harness APIs (`listEventsAfter`,
 * `getEventReplayState`, `listSessionEventsAfter`,
 * `getSessionEventReplayState`) were called against a storage adapter
 * that does not implement the durable session-event ledger
 * (`HarnessStorageCapabilities.sessionEventReplay === false`).
 *
 * This is a typed public error: callers (server routes, A2A
 * `tasks/resubscribe`, headless workers) need to surface a clear
 * "this adapter does not support replay" signal instead of leaking
 * the storage-internal `HarnessStorageSessionEventReplayUnsupportedError`.
 */
export class HarnessEventReplayUnsupportedError extends Error {
  readonly name = 'HarnessEventReplayUnsupportedError';
  readonly code = 'harness.event_replay_unsupported';
  constructor(public readonly api: string) {
    super(`${api}: durable session event replay is not supported by this storage adapter`);
  }
}

const HARNESS_PUBLIC_ERROR_CODES: Record<string, string> = {
  HarnessConfigError: 'harness.validation',
  HarnessRuntimeDependencyDriftError: 'harness.runtime_dependency_drifted',
  HarnessSessionNotFoundError: 'harness.session_not_found',
  HarnessSessionClosedError: 'harness.session_closed',
  HarnessSessionClosingError: 'harness.session_closing',
  HarnessSessionCancelledError: 'harness.session_cancelled',
  HarnessSessionDeleteBlockedError: 'harness.session_delete_blocked',
  HarnessSessionDeletedError: 'harness.session_deleted',
  HarnessSessionLockedError: 'harness.session_locked',
  HarnessValidationError: 'harness.validation',
  HarnessQueueFullError: 'harness.queue_full',
  HarnessAdmissionConflictError: 'harness.admission_conflict',
  HarnessInboxItemNotFoundError: 'harness.inbox_item_not_found',
  HarnessInboxResponseConflictError: 'harness.inbox_response_conflict',
  HarnessStateConflictError: 'harness.state_conflict',
  HarnessAttachmentInUseError: 'harness.attachment_in_use',
  HarnessAttachmentUnavailableError: 'harness.attachment_unavailable',
  HarnessSubagentDepthExceededError: 'harness.subagent_depth_exceeded',
  HarnessStorageError: 'harness.storage',
  HarnessThreadNotFoundError: 'harness.thread_not_found',
  HarnessModelNotFoundError: 'harness.model_not_found',
  HarnessSkillNotFoundError: 'harness.skill_not_found',
  HarnessSkillArgsValidationError: 'harness.skill_args_invalid',
  HarnessOverrideConflictError: 'harness.override_conflict',
  HarnessEventSerializationError: 'harness.event_serialization',
  HarnessWorkspaceProviderMismatchError: 'harness.workspace_provider_mismatch',
  HarnessWorkspaceLostError: 'harness.workspace_lost',
  HarnessWorkspaceProvisioningError: 'harness.workspace_provisioning',
  HarnessWorkspaceInUseError: 'harness.workspace_in_use',
  HarnessEventReplayUnsupportedError: 'harness.event_replay_unsupported',
  HarnessEventReplayStaleCursorError: 'harness.event_replay_stale_cursor',
  HarnessEventReplayEpochMismatchError: 'harness.event_replay_epoch_mismatch',
  HarnessEventReplayFutureCursorError: 'harness.event_replay_future_cursor',
  HarnessEventReplayBufferOverflowError: 'harness.event_replay_buffer_overflow',
  HarnessEventReplayAbortedError: 'harness.event_replay_aborted',
  HarnessArtifactsUnsupportedError: 'harness.artifacts_unsupported',
  HarnessArtifactNotFoundError: 'harness.artifact_not_found',
  HarnessArtifactLineageMismatchError: 'harness.artifact_lineage_mismatch',
  HarnessArtifactVersionConflictError: 'harness.artifact_version_conflict',
  HarnessArtifactDuplicateIdError: 'harness.artifact_duplicate_id',
  HarnessArtifactAttachmentMissingError: 'harness.artifact_attachment_missing',
  HarnessPermissionProfileNotFoundError: 'harness.permission_profile_not_found',
};

export function getHarnessPublicErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && code.length > 0) return code;
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' ? HARNESS_PUBLIC_ERROR_CODES[name] : undefined;
}
