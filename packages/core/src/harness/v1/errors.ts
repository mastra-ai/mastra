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

const HARNESS_PUBLIC_ERROR_CODES: Record<string, string> = {
  HarnessConfigError: 'harness.validation',
  HarnessRuntimeDependencyDriftError: 'harness.runtime_dependency_drifted',
  HarnessSessionNotFoundError: 'harness.session_not_found',
  HarnessSessionClosedError: 'harness.session_closed',
  HarnessSessionClosingError: 'harness.session_closing',
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
};

export function getHarnessPublicErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && code.length > 0) return code;
  const name = (err as { name?: unknown }).name;
  return typeof name === 'string' ? HARNESS_PUBLIC_ERROR_CODES[name] : undefined;
}
