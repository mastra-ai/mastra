import type {
  JsonValue,
  WorkspaceActionJournalEntry,
  WorkspaceActionJournalPath,
  WorkspaceActionJournalPathFilter,
} from '../../storage/domains/harness';
import { HarnessValidationError } from './errors';

/** Selects which workspace journal entries should be projected into a restore plan. */
export type WorkspaceRestoreScope =
  | { kind: 'session' }
  | { kind: 'turn'; requestId: string }
  /**
   * File scope follows the storage affected-path filter contract: source
   * `path` is matched by default, and rename destinations require
   * `includeToPath: true` on the selector.
   */
  | { kind: 'file'; affectedPath: WorkspaceActionJournalPathFilter };

/** Operation the host should perform, or inspect, to reverse a journal entry. */
export type WorkspaceRestoreStepKind =
  | 'restore_file'
  | 'delete_file'
  | 'move_path'
  | 'reverse_patch'
  | 'skip'
  | 'manual_review';

/** Whether a restore step is actionable, needs review, or has no effect. */
export type WorkspaceRestoreStepStatus = 'planned' | 'blocked' | 'skipped';

/** Conflict classification for a projected restore step. */
export type WorkspaceRestoreConflictStatus =
  | 'unknown'
  | 'clean'
  | 'external_change'
  | 'missing_before_snapshot'
  | 'unsupported_operation'
  | 'no_effect';

/** Human-readable conflict information for a restore step. */
export interface WorkspaceRestoreConflict {
  status: WorkspaceRestoreConflictStatus;
  message?: string;
}

/** Planned restore work derived from one workspace action journal entry. */
export interface WorkspaceRestorePlanStep {
  id: string;
  journalEntryId: string;
  actionKind: WorkspaceActionJournalEntry['actionKind'];
  operation?: string;
  kind: WorkspaceRestoreStepKind;
  status: WorkspaceRestoreStepStatus;
  conflict: WorkspaceRestoreConflict;
  path?: WorkspaceActionJournalPath;
  toPath?: WorkspaceActionJournalPath;
  snapshot?: JsonValue;
}

/** A workspace path touched by the selected journal entries. */
export interface WorkspaceRestoreAffectedPath {
  path: WorkspaceActionJournalPath;
  lastJournalEntryId: string;
}

/** Ordered restore plan for the selected workspace journal scope. */
export interface WorkspaceRestorePlan {
  scope: WorkspaceRestoreScope;
  steps: WorkspaceRestorePlanStep[];
  affectedPaths: WorkspaceRestoreAffectedPath[];
  truncated: boolean;
}

/** Inputs for pure workspace restore planning. */
export interface CreateWorkspaceRestorePlanOptions {
  scope: WorkspaceRestoreScope;
  /**
   * Entries must already be scoped by the host's tenant/session fence
   * (`harnessName`, `resourceId`, `sessionId`, and optional `threadId`).
   * The planner is a pure projection and does not perform auth isolation.
   */
  entries: readonly WorkspaceActionJournalEntry[];
  /**
   * Bounds host-provided input before planning. Use storage pagination for
   * complete large plans. When truncated, the planner keeps the newest rows so
   * restore steps still start from the live workspace's latest mutations.
   */
  limit?: number;
}

const DEFAULT_RESTORE_PLAN_LIMIT = 500;
const FILE_MUTATION_OPERATIONS = new Set(['write', 'delete', 'rename', 'patch']);
const FILE_NON_MUTATION_OPERATIONS = new Set(['read', 'readFile', 'listFiles', 'grep', 'stat', 'lspInspect']);

/** Builds an ordered restore plan from already-scoped workspace action journal entries. */
export function createWorkspaceRestorePlan({
  scope,
  entries,
  limit = DEFAULT_RESTORE_PLAN_LIMIT,
}: CreateWorkspaceRestorePlanOptions): WorkspaceRestorePlan {
  if (scope.kind === 'file' && !workspaceActionPathFilterHasSelector(scope.affectedPath)) {
    throw new HarnessValidationError(
      'scope.affectedPath',
      'File restore scope requires at least one affected path selector',
    );
  }
  const planLimit = boundRestorePlanLimit(limit);
  const matchingEntries = [...entries]
    .filter(entry => workspaceRestoreEntryMatchesScope(entry, scope))
    .sort(compareWorkspaceRestoreEntries);
  const selectedEntries = matchingEntries.slice(Math.max(0, matchingEntries.length - planLimit));
  const steps = [...selectedEntries].reverse().map(projectWorkspaceRestoreStep);

  return {
    scope: cloneJson(scope),
    steps,
    affectedPaths: collectAffectedPaths(selectedEntries),
    truncated: matchingEntries.length > selectedEntries.length,
  };
}

/** Returns true when a workspace action journal entry belongs to the requested restore scope. */
export function workspaceRestoreEntryMatchesScope(
  entry: WorkspaceActionJournalEntry,
  scope: WorkspaceRestoreScope,
): boolean {
  if (scope.kind === 'session') return true;
  if (scope.kind === 'turn') return entry.requestId === scope.requestId;
  return (
    workspaceActionPathMatches(entry.path, scope.affectedPath) ||
    (scope.affectedPath.includeToPath === true && workspaceActionPathMatches(entry.toPath, scope.affectedPath))
  );
}

/** Projects one journal row into host-executable restore work or a review-only step. */
function projectWorkspaceRestoreStep(entry: WorkspaceActionJournalEntry): WorkspaceRestorePlanStep {
  if (entry.policyDecision === 'deny') {
    return {
      ...baseStep(entry, 'skip', 'skipped'),
      conflict: { status: 'no_effect', message: 'Denied workspace action did not mutate the workspace' },
    };
  }

  if (entry.actionKind !== 'file') {
    return blockedStep(entry, 'manual_review', 'unsupported_operation', 'Only file journal entries can be restored');
  }

  if (!entry.operation || FILE_NON_MUTATION_OPERATIONS.has(entry.operation)) {
    return {
      ...baseStep(entry, 'skip', 'skipped'),
      conflict: { status: 'no_effect', message: 'Non-mutating file action does not require restore work' },
    };
  }

  if (!FILE_MUTATION_OPERATIONS.has(entry.operation)) {
    return blockedStep(
      entry,
      'manual_review',
      'unsupported_operation',
      'Unsupported file operation requires manual restore review',
    );
  }

  if (entry.operation === 'rename') {
    if (!entry.path || !entry.toPath) {
      return blockedStep(
        entry,
        'move_path',
        'missing_before_snapshot',
        'Rename restore requires source and target paths',
      );
    }
    const destinationBefore = getResultSnapshot(entry.result, 'toBefore');
    if (destinationBefore === undefined) {
      return blockedStep(
        entry,
        'move_path',
        'missing_before_snapshot',
        'Rename restore requires explicit result.toBefore destination evidence',
      );
    }
    if (destinationBefore !== undefined && destinationBefore !== null) {
      return blockedStep(
        entry,
        'manual_review',
        'unsupported_operation',
        'Rename restore with overwritten destination content requires manual review',
      );
    }
    return {
      ...baseStep(entry, 'move_path', 'planned'),
      path: cloneJson(entry.toPath),
      toPath: cloneJson(entry.path),
      conflict: { status: 'unknown' },
    };
  }

  if (!entry.path) {
    return blockedStep(entry, 'manual_review', 'unsupported_operation', 'File restore requires a path');
  }

  const before = getResultSnapshot(entry.result, 'before');
  if (before === undefined) {
    return blockedStep(
      entry,
      restoreKindForOperation(entry.operation),
      'missing_before_snapshot',
      'Restore requires result.before evidence',
    );
  }

  if (before === null) {
    if (entry.operation === 'delete') {
      return {
        ...baseStep(entry, 'skip', 'skipped'),
        conflict: { status: 'no_effect', message: 'Delete action did not remove an existing file' },
      };
    }
    if (entry.operation === 'patch') {
      return blockedStep(
        entry,
        'reverse_patch',
        'missing_before_snapshot',
        'Patch restore requires a concrete before snapshot',
      );
    }
    return {
      ...baseStep(entry, 'delete_file', 'planned'),
      path: cloneJson(entry.path),
      snapshot: null,
      conflict: { status: 'unknown' },
    };
  }

  return {
    ...baseStep(entry, restoreKindForOperation(entry.operation), 'planned'),
    path: cloneJson(entry.path),
    snapshot: cloneJson(before),
    conflict: { status: 'unknown' },
  };
}

/** Maps file mutation operations to the restore action kind a host should perform. */
function restoreKindForOperation(operation: string): WorkspaceRestoreStepKind {
  if (operation === 'patch') return 'reverse_patch';
  return 'restore_file';
}

/** Copies common journal metadata into a detached restore step shell. */
function baseStep(
  entry: WorkspaceActionJournalEntry,
  kind: WorkspaceRestoreStepKind,
  status: WorkspaceRestoreStepStatus,
): Omit<WorkspaceRestorePlanStep, 'conflict'> {
  return {
    id: `restore:${entry.id}`,
    journalEntryId: entry.id,
    actionKind: entry.actionKind,
    ...(entry.operation ? { operation: entry.operation } : {}),
    kind,
    status,
    ...(entry.path ? { path: cloneJson(entry.path) } : {}),
    ...(entry.toPath ? { toPath: cloneJson(entry.toPath) } : {}),
  };
}

/** Builds a blocked restore step with a typed conflict reason. */
function blockedStep(
  entry: WorkspaceActionJournalEntry,
  kind: WorkspaceRestoreStepKind,
  status: WorkspaceRestoreConflictStatus,
  message: string,
): WorkspaceRestorePlanStep {
  return {
    ...baseStep(entry, kind, 'blocked'),
    conflict: { status, message },
  };
}

/** Summarizes distinct source and destination paths touched by selected journal rows. */
function collectAffectedPaths(entries: readonly WorkspaceActionJournalEntry[]): WorkspaceRestoreAffectedPath[] {
  const byPath = new Map<string, WorkspaceRestoreAffectedPath>();
  for (const entry of entries) {
    for (const affectedPath of [entry.path, entry.toPath]) {
      if (!affectedPath) continue;
      byPath.set(workspaceActionPathKey(affectedPath), {
        path: cloneJson(affectedPath),
        lastJournalEntryId: entry.id,
      });
    }
  }
  return [...byPath.values()].sort((left, right) =>
    workspaceActionPathKey(left.path).localeCompare(workspaceActionPathKey(right.path)),
  );
}

/** Applies the journal affected-path selector contract to one resolved workspace path. */
function workspaceActionPathMatches(
  path: WorkspaceActionJournalPath | undefined,
  filter: WorkspaceActionJournalPathFilter,
): boolean {
  if (!path || !workspaceActionPathFilterHasSelector(filter)) return false;
  if (filter.rootId !== undefined && path.rootId !== filter.rootId) return false;
  if (filter.path !== undefined && path.path !== filter.path) return false;
  if (filter.relativePath !== undefined && path.relativePath !== filter.relativePath) return false;
  return true;
}

/** Returns true when a path filter contains at least one concrete selector. */
function workspaceActionPathFilterHasSelector(filter: WorkspaceActionJournalPathFilter): boolean {
  return filter.rootId !== undefined || filter.path !== undefined || filter.relativePath !== undefined;
}

/** Builds a deterministic path identity key for de-duplicating affected paths. */
function workspaceActionPathKey(path: WorkspaceActionJournalPath): string {
  return `${path.rootId}\0${path.path}\0${path.relativePath}`;
}

/** Orders journal rows the same way storage pagination orders them. */
function compareWorkspaceRestoreEntries(left: WorkspaceActionJournalEntry, right: WorkspaceActionJournalEntry): number {
  return left.createdAt - right.createdAt || compareWorkspaceActionJournalId(left.id, right.id);
}

/** Compares journal ids without locale-dependent collation. */
function compareWorkspaceActionJournalId(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Reads restore evidence from result records while preserving explicit null values. */
function getResultSnapshot(result: JsonValue | undefined, key: 'before' | 'toBefore'): JsonValue | undefined {
  if (!isJsonRecord(result) || !(key in result)) return undefined;
  return result[key];
}

/** Narrows JSON values to plain object records. */
function isJsonRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates and returns the maximum number of journal rows to project. */
function boundRestorePlanLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new HarnessValidationError('limit', 'Workspace restore plan limit must be a positive safe integer');
  }
  return limit;
}

/** Produces detached JSON-safe output objects for the public plan DTO. */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
