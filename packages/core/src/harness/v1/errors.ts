/**
 * Harness v1 error taxonomy.
 *
 * These names match the fork's v1 runtime and are introduced before the
 * behavior lands so consumers can type against the public failure surface.
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

export class HarnessSessionNotFoundError extends Error {
  readonly name = 'HarnessSessionNotFoundError';

  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" not found`);
  }
}

export class HarnessSessionClosedError extends Error {
  readonly name = 'HarnessSessionClosedError';

  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" is closed`);
  }
}

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

export class HarnessValidationError extends Error {
  readonly name = 'HarnessValidationError';

  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`HarnessValidationError at ${field}: ${reason}`);
  }
}

export class HarnessQueueFullError extends Error {
  readonly name = 'HarnessQueueFullError';

  constructor(
    public readonly sessionId: string,
    public readonly maxQueueDepth: number,
  ) {
    super(`Queue for session "${sessionId}" is full (max ${maxQueueDepth})`);
  }
}

export class HarnessSubagentDepthExceededError extends Error {
  readonly name = 'HarnessSubagentDepthExceededError';

  constructor(
    public readonly sessionId: string,
    public readonly depth: number,
    public readonly maxDepth: number,
  ) {
    super(`Session "${sessionId}" cannot spawn a subagent: depth ${depth} >= maxDepth ${maxDepth}`);
  }
}

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

export class HarnessThreadNotFoundError extends Error {
  readonly name = 'HarnessThreadNotFoundError';

  constructor(
    public readonly resourceId: string,
    public readonly threadId: string,
  ) {
    super(`Thread "${threadId}" not found for resource "${resourceId}"`);
  }
}

export class HarnessModelNotFoundError extends Error {
  readonly name = 'HarnessModelNotFoundError';

  constructor(public readonly modelId: string) {
    super(`Model "${modelId}" is not present in the harness model catalog`);
  }
}

export class HarnessSkillNotFoundError extends Error {
  readonly name = 'HarnessSkillNotFoundError';

  constructor(
    public readonly skillName: string,
    public readonly searchedSources: ReadonlyArray<'workspace'>,
  ) {
    super(`Skill "${skillName}" not found (searched: ${searchedSources.join(', ') || 'none'})`);
  }
}

export class HarnessSkillArgsValidationError extends Error {
  readonly name = 'HarnessSkillArgsValidationError';

  constructor(
    public readonly skillName: string,
    public readonly issues: ReadonlyArray<string>,
  ) {
    super(`Skill "${skillName}" args invalid: ${issues.join('; ')}`);
  }
}

export class HarnessOverrideConflictError extends Error {
  readonly name = 'HarnessOverrideConflictError';

  constructor(
    public readonly sessionId: string,
    public readonly field: 'mode' | 'additionalTools' | 'model',
    public readonly reason: string,
  ) {
    super(`HarnessOverrideConflictError on session "${sessionId}" for "${field}": ${reason}`);
  }
}

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
  | 'non-finite-number'
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

export class HarnessWorkspaceInUseError extends Error {
  readonly name = 'HarnessWorkspaceInUseError';

  constructor(
    public readonly resourceId: string,
    public readonly refCount: number,
  ) {
    super(`Workspace for resource "${resourceId}" is in use (refCount: ${refCount})`);
  }
}
