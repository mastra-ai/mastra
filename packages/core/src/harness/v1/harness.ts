/**
 * Harness v1 — top-level entry point.
 *
 * See HARNESS_V1_SPEC.md §4 for the full surface. This module currently
 * implements the local Harness shell:
 *
 *   - `new Harness(config)` validates modes/agents and binds storage.
 *   - `harness.session(opts)` finds-or-creates sessions per §5.3, acquiring
 *     the durable lease and hydrating from `HarnessStorage`.
 *   - `harness.closeSession`, `harness.deleteSession`, `harness.listSessions`,
 *     and `harness.shutdown` handle local lifecycle paths.
 *   - `harness.threads.*` composes with MemoryStorage for thread CRUD/settings.
 *   - `harness.models.*` exposes the static model catalog and auth-status
 *     resolver.
 *
 * Known remaining gaps are deliberately visible here: production server routes,
 * remote SDKs, full channel routing, wakeup producers/completion, and
 * acceptance evidence live in follow-up Harness v1 lanes.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';

import type { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MCPServerBase } from '../../mcp';
import type {
  PermissionRules,
  SessionGrants,
  SessionRecord,
  SessionSummary,
  TokenUsage,
  HarnessStorage,
  AttachmentSource,
  AttachmentRecord,
  AttachmentSemanticMetadata,
  JsonValue,
  HarnessRowErrorCode,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelDiagnosticsRows,
  ChannelInboxItem,
  ChannelOutboxEnqueueOptions,
  ChannelOutboxItem,
  ChannelProviderDeliveryReceipt,
  AgentSignalResultStatus,
  HarnessArtifactRecord,
  InboxResponseReceipt,
  OperationAdmissionTombstone,
  QueueAdmissionReceipt,
  HarnessRuntimeDependencyRefs,
  HarnessSessionEventRecord,
  HarnessSessionEventReplayState,
} from '../../storage/domains/harness';
import {
  HarnessStorageArtifactAttachmentMissingError,
  HarnessStorageArtifactDuplicateIdError,
  HarnessStorageArtifactLineageMismatchError,
  HarnessStorageArtifactNotFoundError,
  HarnessStorageArtifactVersionConflictError,
  HarnessStorageArtifactsUnsupportedError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageChannelOutboxClaimConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStorageParentSessionUnavailableError,
  HarnessStorageSessionEventReplayUnsupportedError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageThreadDeleteFenceUnsupportedError,
  HarnessStorageVersionConflictError,
} from '../../storage/domains/harness';
import type { MemoryStorage } from '../../storage/domains/memory/base';

import { InMemoryStore } from '../../storage/mock';
import type { Workspace } from '../../workspace';

import { HarnessChannelRegistry } from './channel-registry';
import {
  HarnessAttachmentInUseError,
  HarnessAttachmentUnavailableError,
  HarnessArtifactAttachmentMissingError,
  HarnessArtifactDuplicateIdError,
  HarnessArtifactLineageMismatchError,
  HarnessArtifactNotFoundError,
  HarnessArtifactVersionConflictError,
  HarnessArtifactsUnsupportedError,
  HarnessConfigError,
  HarnessEventReplayUnsupportedError,
  HarnessModelNotFoundError,
  HarnessRuntimeDependencyDriftError,
  HarnessSessionClosedError,
  HarnessSessionClosingError,
  HarnessSessionDeleteBlockedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessStorageError,
  HarnessThreadNotFoundError,
  HarnessValidationError,
  HarnessWorkspaceProviderMismatchError,
} from './errors';
import { EventEmitter } from './events';
import type { HarnessEvent, HarnessEventListener, HarnessEventUnsubscribe } from './events';
import { HARNESS_PERMISSION_PROFILES } from './permission-profiles';
import type { HarnessPermissionProfile, HarnessPermissionProfileName } from './permission-profiles';
import { Session } from './session';
import type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  ChannelOutboxDispatchOptions,
  ChannelOutboxDispatchResult,
  HarnessChannelDiagnostics,
  HarnessChannelDiagnosticsOptions,
  HarnessChannelBinding,
  HarnessChannelConfig,
  HarnessConfig,
  HarnessFileConfig,
  HeartbeatHandler,
  HarnessMode,
  HarnessQueueBackpressurePolicy,
  HarnessSkill,
  HarnessSkillActionMetadata,
  HarnessSkillActionPermissionHints,
  HarnessSkillActionShortcut,
  ModelAuthStatus,
  ModelInfo,
  PermissionPolicy,
  SessionListOptions,
  SessionDeleteOptions,
  SessionLoadByIdOptions,
  SessionResolveOptions,
  ShutdownOptions,
  SubagentDefinition,
  ThreadCloneOptions,
  ThreadCreateOptions,
  ThreadDeleteOptions,
  ThreadGetOptions,
  ThreadGetSettingOptions,
  ThreadGetSettingsOptions,
  ThreadListOptions,
  ThreadListResult,
  ThreadRecord,
  ThreadRenameOptions,
  ThreadSelectOrCreateOptions,
  ThreadSetSettingsOptions,
  ToolCategory,
} from './types';
import type { WorkspacePolicy } from './workspace/policy';
import { WorkspaceRegistry } from './workspace/registry';

const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_MAX_QUEUE_DEPTH = 100;
const DEFAULT_CLOSE_TIMEOUT_MS = 30_000;
const MAX_CLOSE_TIMEOUT_MS = 2_147_483_647;
const DEFAULT_SUBAGENT_MAX_DEPTH = 1;
const DEFAULT_GOAL_MAX_TURNS = 50;
const DEFAULT_PERMISSION_POLICY: PermissionPolicy = 'ask';
const DEFAULT_CHANNEL_OUTBOX_CLAIM_TTL_MS = 30_000;
const DEFAULT_CHANNEL_OUTBOX_BATCH_SIZE = 10;
const DEFAULT_CHANNEL_OUTBOX_MAX_ATTEMPTS = 3;
const CHANNEL_DIAGNOSTICS_DEFAULT_LIMIT = 50;
const CHANNEL_DIAGNOSTICS_MAX_DESCENDANT_DEPTH = 32;

/**
 * Top-level keys recognized on `HarnessConfig` (the union of
 * `HarnessConfigCommon` fields plus the `mastra` / `agents` /
 * `storage` discriminants). The constructor warns — not throws —
 * on any key not in this set so typo'd or stale userland configs
 * surface loudly without breaking existing callers. The catch-all
 * `[key: string]: unknown` on `HarnessConfigCommon` is preserved
 * for now; a future slice can lift the warn to a hard error once
 * downstream consumers have a chance to migrate.
 */
const HARNESS_CONFIG_KNOWN_KEYS: ReadonlySet<string> = new Set([
  // HarnessConfigCommon
  'channels',
  'defaultModeId',
  'defaultPermissionPolicy',
  'files',
  'goals',
  'heartbeatHandlers',
  'modelAuthStatusResolver',
  'models',
  'modes',
  'runtimeCompatibilityGeneration',
  'sessions',
  'skills',
  'subagents',
  'toolCategories',
  'toolCategoryResolver',
  'workspace',
  // HarnessConfig discriminants (mastra-mode vs agents+storage-mode)
  'mastra',
  'agents',
  'storage',
]);
const CHANNEL_DIAGNOSTICS_MAX_VISIBLE_SESSIONS = 256;

type CloseTreeNode = {
  record: SessionRecord;
  depth: number;
  live?: Session;
  leaseAcquired: boolean;
};

type HeartbeatEntry = {
  timer: ReturnType<typeof setInterval>;
  shutdown?: () => void | Promise<void>;
};

type TrackedHeartbeatWork = {
  promise: Promise<void>;
  enteredStop: Promise<void>;
  markEnteredStop: () => void;
};

function cloneHarnessSkill(skill: HarnessSkill): HarnessSkill {
  return {
    ...skill,
    ...(skill.action ? { action: cloneHarnessSkillActionMetadata(skill.action) } : {}),
    ...(skill.metadata ? { metadata: cloneSkillMetadata(skill.metadata, new WeakMap()) } : {}),
  };
}

function cloneHarnessSkillActionMetadata(action: HarnessSkillActionMetadata): HarnessSkillActionMetadata {
  return {
    ...action,
    ...(action.shortcuts ? { shortcuts: action.shortcuts.map(cloneHarnessSkillActionShortcut) } : {}),
    ...(action.inputSchema ? { inputSchema: cloneSkillMetadata(action.inputSchema, new WeakMap()) } : {}),
    ...(action.outputSchema ? { outputSchema: cloneSkillMetadata(action.outputSchema, new WeakMap()) } : {}),
    ...(action.artifactTypes ? { artifactTypes: [...action.artifactTypes] } : {}),
    ...(action.permissions ? { permissions: cloneHarnessSkillActionPermissionHints(action.permissions) } : {}),
  };
}

function cloneHarnessSkillActionShortcut(shortcut: HarnessSkillActionShortcut): HarnessSkillActionShortcut {
  return {
    ...shortcut,
    ...(shortcut.keys ? { keys: [...shortcut.keys] } : {}),
  };
}

function cloneHarnessSkillActionPermissionHints(
  permissions: HarnessSkillActionPermissionHints,
): HarnessSkillActionPermissionHints {
  return {
    ...(permissions.tools ? { tools: [...permissions.tools] } : {}),
    ...(permissions.fileScopes ? { fileScopes: [...permissions.fileScopes] } : {}),
    ...(permissions.networkScopes ? { networkScopes: [...permissions.networkScopes] } : {}),
    ...(permissions.mcpScopes ? { mcpScopes: [...permissions.mcpScopes] } : {}),
  };
}

function cloneSkillMetadata(
  metadata: Record<string, unknown>,
  seen: WeakMap<object, unknown>,
): Record<string, unknown> {
  const existing = seen.get(metadata);
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }
  const clone: Record<string, unknown> = {};
  seen.set(metadata, clone);
  for (const [key, value] of Object.entries(metadata)) {
    clone[key] = cloneSkillMetadataValue(value, seen);
  }
  return clone;
}

function cloneSkillMetadataValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (Array.isArray(value)) {
    const existing = seen.get(value);
    if (Array.isArray(existing)) return existing;
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const child of value) {
      clone.push(cloneSkillMetadataValue(child, seen));
    }
    return clone;
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === Object.prototype || prototype === null) {
      return cloneSkillMetadata(value as Record<string, unknown>, seen);
    }
  }
  return value;
}

function isPlainSkillMetadata(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyCloneableSkillMetadataValues(value: unknown, seen: WeakSet<object>): boolean {
  if (typeof value === 'function') return false;
  if (Array.isArray(value)) {
    if (seen.has(value)) return true;
    seen.add(value);
    const supported = value.every(child => hasOnlyCloneableSkillMetadataValues(child, seen));
    seen.delete(value);
    return supported;
  }
  if (value && typeof value === 'object') {
    if (!isPlainSkillMetadata(value)) return false;
    if (seen.has(value)) return true;
    seen.add(value);
    const supported = Object.values(value).every(child => hasOnlyCloneableSkillMetadataValues(child, seen));
    seen.delete(value);
    return supported;
  }
  return true;
}

function assertHarnessSkillActionMetadata(
  action: unknown,
  skillName: string,
): asserts action is HarnessSkillActionMetadata {
  if (!isPlainSkillMetadata(action)) {
    throw new HarnessConfigError('skills', `entry "${skillName}" action must be an object`);
  }
  const metadata = action as HarnessSkillActionMetadata;
  if (metadata.displayName !== undefined && typeof metadata.displayName !== 'string') {
    throw new HarnessConfigError('skills', `entry "${skillName}" action.displayName must be a string`);
  }
  if (metadata.icon !== undefined && typeof metadata.icon !== 'string') {
    throw new HarnessConfigError('skills', `entry "${skillName}" action.icon must be a string`);
  }
  if (metadata.shortcuts !== undefined) {
    if (!Array.isArray(metadata.shortcuts)) {
      throw new HarnessConfigError('skills', `entry "${skillName}" action.shortcuts must be an array`);
    }
    const ids = new Set<string>();
    for (const shortcut of metadata.shortcuts) {
      assertHarnessSkillActionShortcut(shortcut, skillName);
      if (ids.has(shortcut.id)) {
        throw new HarnessConfigError(
          'skills',
          `entry "${skillName}" action.shortcuts has duplicate id "${shortcut.id}"`,
        );
      }
      ids.add(shortcut.id);
    }
  }
  assertOptionalPlainActionSchema(metadata.inputSchema, skillName, 'inputSchema');
  assertOptionalPlainActionSchema(metadata.outputSchema, skillName, 'outputSchema');
  assertOptionalStringArray(metadata.artifactTypes, skillName, 'action.artifactTypes');
  if (metadata.permissions !== undefined) {
    assertHarnessSkillActionPermissionHints(metadata.permissions, skillName);
  }
}

function assertHarnessSkillActionShortcut(
  shortcut: unknown,
  skillName: string,
): asserts shortcut is HarnessSkillActionShortcut {
  if (!isPlainSkillMetadata(shortcut)) {
    throw new HarnessConfigError('skills', `entry "${skillName}" action.shortcuts entries must be objects`);
  }
  if (typeof shortcut.id !== 'string' || shortcut.id.length === 0) {
    throw new HarnessConfigError('skills', `entry "${skillName}" action.shortcuts entries must have a non-empty id`);
  }
  if (shortcut.label !== undefined && typeof shortcut.label !== 'string') {
    throw new HarnessConfigError(
      'skills',
      `entry "${skillName}" action.shortcuts["${shortcut.id}"].label must be a string`,
    );
  }
  assertOptionalStringArray(shortcut.keys, skillName, `action.shortcuts["${shortcut.id}"].keys`);
}

function assertOptionalPlainActionSchema(
  value: unknown,
  skillName: string,
  field: 'inputSchema' | 'outputSchema',
): void {
  if (value === undefined) return;
  if (!isPlainSkillMetadata(value)) {
    throw new HarnessConfigError('skills', `entry "${skillName}" action.${field} must be an object`);
  }
  if (!hasOnlyCloneableSkillMetadataValues(value, new WeakSet<object>())) {
    throw new HarnessConfigError(
      'skills',
      `entry "${skillName}" action.${field} must contain only primitives, arrays, and plain objects`,
    );
  }
}

function assertHarnessSkillActionPermissionHints(permissions: unknown, skillName: string): void {
  if (!isPlainSkillMetadata(permissions)) {
    throw new HarnessConfigError('skills', `entry "${skillName}" action.permissions must be an object`);
  }
  assertOptionalStringArray(permissions.tools, skillName, 'action.permissions.tools');
  assertOptionalStringArray(permissions.fileScopes, skillName, 'action.permissions.fileScopes');
  assertOptionalStringArray(permissions.networkScopes, skillName, 'action.permissions.networkScopes');
  assertOptionalStringArray(permissions.mcpScopes, skillName, 'action.permissions.mcpScopes');
}

function assertOptionalStringArray(value: unknown, skillName: string, field: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.length > 0)) {
    throw new HarnessConfigError('skills', `entry "${skillName}" ${field} must be an array of non-empty strings`);
  }
}

function assertAttachmentJsonValue(value: unknown, field: string, seen: WeakSet<object> = new WeakSet()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new HarnessValidationError(field, 'attachment JSON values must be finite numbers');
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new HarnessValidationError(field, 'attachment value must not contain cycles');
    seen.add(value);
    const out: JsonValue[] = [];
    try {
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          throw new HarnessValidationError(`${field}[${index}]`, 'attachment arrays must not contain holes');
        }
        out.push(assertAttachmentJsonValue(value[index], `${field}[${index}]`, seen));
      }
    } finally {
      seen.delete(value);
    }
    return out;
  }
  if (value && typeof value === 'object' && isPlainSkillMetadata(value)) {
    if (seen.has(value)) throw new HarnessValidationError(field, 'attachment value must not contain cycles');
    seen.add(value);
    const out: Record<string, JsonValue> = {};
    try {
      for (const [key, child] of Object.entries(value)) {
        if (child !== undefined) out[key] = assertAttachmentJsonValue(child, `${field}.${key}`, seen);
      }
    } finally {
      seen.delete(value);
    }
    return out;
  }
  throw new HarnessValidationError(field, 'attachment value must be JSON-serialisable');
}

function assertAttachmentJsonRecord(value: unknown, field: string): Record<string, JsonValue> {
  const record = assertAttachmentJsonValue(value, field);
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new HarnessValidationError(field, 'attachment metadata must be a JSON object');
  }
  return record;
}

function canonicalAttachmentJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalAttachmentJson).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalAttachmentJson(value[key]!)}`)
    .join(',')}}`;
}

function optionalAttachmentJsonMatches(current: JsonValue | undefined, next: JsonValue | undefined): boolean {
  if (current === undefined && next === undefined) return true;
  if (current === undefined || next === undefined) return false;
  return canonicalAttachmentJson(current) === canonicalAttachmentJson(next);
}

function attachmentSemanticMatches(current: AttachmentSemanticMetadata, next: AttachmentSemanticMetadata): boolean {
  return (
    current.kind === next.kind &&
    current.primitiveType === next.primitiveType &&
    current.elementType === next.elementType &&
    current.schemaId === next.schemaId &&
    optionalAttachmentJsonMatches(current.renderer as JsonValue | undefined, next.renderer as JsonValue | undefined) &&
    optionalAttachmentJsonMatches(current.metadata as JsonValue | undefined, next.metadata as JsonValue | undefined) &&
    optionalAttachmentJsonMatches(current.object as JsonValue | undefined, next.object as JsonValue | undefined)
  );
}

function attachmentSemanticFromRecord(record: AttachmentRecord): AttachmentSemanticMetadata {
  return {
    ...(record.kind ? { kind: record.kind } : {}),
    ...(record.primitiveType ? { primitiveType: record.primitiveType } : {}),
    ...(record.elementType ? { elementType: record.elementType } : {}),
    ...(record.renderer ? { renderer: record.renderer } : {}),
    ...(record.schemaId ? { schemaId: record.schemaId } : {}),
    ...(record.metadata ? { metadata: record.metadata } : {}),
    ...(record.object ? { object: record.object } : {}),
  };
}

function encodeAttachmentJson(value: JsonValue): Uint8Array {
  return new TextEncoder().encode(canonicalAttachmentJson(value));
}

function hasExternalSessionStorageOwner(metadata: unknown): boolean {
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>)[EXTERNAL_SESSION_STORAGE_OWNER_METADATA_KEY] === true
  );
}

function hasHarnessThreadDeleteInProgress(metadata: unknown): boolean {
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>)[HARNESS_THREAD_DELETE_IN_PROGRESS_METADATA_KEY] === true
  );
}

const boundHarnessesByMastra = new WeakMap<Mastra, Set<Harness>>();
const boundHarnessesByMemory = new WeakMap<object, Set<Harness>>();
const EXTERNAL_SESSION_STORAGE_OWNER_METADATA_KEY = '__mastraHarnessExternalSessionStorageOwner';
const HARNESS_THREAD_DELETE_IN_PROGRESS_METADATA_KEY = '__mastraHarnessThreadDeleteInProgress';
const HARNESS_INTERNAL_THREAD_METADATA_KEYS = new Set([
  EXTERNAL_SESSION_STORAGE_OWNER_METADATA_KEY,
  HARNESS_THREAD_DELETE_IN_PROGRESS_METADATA_KEY,
]);

function assertNoHarnessInternalThreadMetadata(metadata: unknown, callsite: string): void {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return;
  for (const key of Object.keys(metadata)) {
    if (HARNESS_INTERNAL_THREAD_METADATA_KEYS.has(key)) {
      throw new HarnessConfigError(callsite, `metadata key "${key}" is reserved for Harness internals`);
    }
  }
}

function stripHarnessInternalThreadMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const publicMetadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!HARNESS_INTERNAL_THREAD_METADATA_KEYS.has(key)) publicMetadata[key] = value;
  }
  return Object.keys(publicMetadata).length > 0 ? publicMetadata : undefined;
}

function projectChannelDiagnostics(
  session: SessionRecord,
  bindings: HarnessChannelBinding[],
  rows: ChannelDiagnosticsRows,
  visibleSessionIds: string[],
  limit: number,
  visibleSessionIdsTruncated: boolean,
): HarnessChannelDiagnostics {
  const trim = <T>(items: T[]) => items.slice(0, limit);
  const visibleBindingIds = new Set<string>();
  for (const item of rows.inbox) if (item.bindingId !== undefined) visibleBindingIds.add(item.bindingId);
  for (const item of rows.actionTokens) visibleBindingIds.add(item.bindingId);
  for (const item of rows.actionReceipts) visibleBindingIds.add(item.bindingId);
  for (const item of rows.outbox) visibleBindingIds.add(item.bindingId);
  const truncated =
    visibleSessionIdsTruncated ||
    rows.inbox.length > limit ||
    rows.actionTokens.length > limit ||
    rows.actionReceipts.length > limit ||
    rows.outbox.length > limit;
  const now = Date.now();
  return {
    harnessName: session.harnessName,
    resourceId: session.resourceId,
    sessionId: session.id,
    visibleSessionIds,
    bindings: bindings.filter(binding => visibleBindingIds.has(binding.bindingId)),
    inbox: trim(rows.inbox).map(projectChannelInboxDiagnostic),
    actionTokens: trim(rows.actionTokens).map(token => projectChannelActionTokenDiagnostic(token, now)),
    actionReceipts: trim(rows.actionReceipts).map(projectChannelActionReceiptDiagnostic),
    outbox: trim(rows.outbox).map(projectChannelOutboxDiagnostic),
    limit,
    truncated,
    redacted: true,
  };
}

function resolveChannelDiagnosticsLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return CHANNEL_DIAGNOSTICS_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), CHANNEL_DIAGNOSTICS_DEFAULT_LIMIT);
}

function projectChannelLeaseDiagnostic(row: {
  attempts: number;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
}): HarnessChannelDiagnostics['inbox'][number]['lease'] {
  return {
    attempts: row.attempts,
    ...(row.claimExpiresAt !== undefined ? { claimExpiresAt: row.claimExpiresAt } : {}),
    ...(row.nextAttemptAt !== undefined ? { nextAttemptAt: row.nextAttemptAt } : {}),
  };
}

function projectChannelError(error: { code: HarnessRowErrorCode; retryable?: boolean } | undefined) {
  if (!error) return undefined;
  return { code: error.code, ...(error.retryable !== undefined ? { retryable: error.retryable } : {}) };
}

function projectChannelInboxDiagnostic(item: ChannelInboxItem): HarnessChannelDiagnostics['inbox'][number] {
  return {
    id: item.id,
    status: item.status,
    channelId: item.channelId,
    providerId: item.providerId,
    ...(item.bindingId !== undefined ? { bindingId: item.bindingId } : {}),
    admissionId: item.admissionId,
    ...(item.resourceId !== undefined ? { resourceId: item.resourceId } : {}),
    ...(item.threadId !== undefined ? { threadId: item.threadId } : {}),
    ...(item.sessionId !== undefined ? { sessionId: item.sessionId } : {}),
    ...(item.runId !== undefined ? { runId: item.runId } : {}),
    ...(item.signalId !== undefined ? { signalId: item.signalId } : {}),
    ...(item.queuedItemId !== undefined ? { queuedItemId: item.queuedItemId } : {}),
    externalMessageId: item.externalMessageId,
    ...(item.delivery !== undefined ? { delivery: item.delivery } : {}),
    ...(item.mode !== undefined ? { mode: item.mode } : {}),
    ...(item.model !== undefined ? { model: item.model } : {}),
    receivedAt: item.receivedAt,
    ...(item.admittedAt !== undefined ? { admittedAt: item.admittedAt } : {}),
    ...(item.acceptedAt !== undefined ? { acceptedAt: item.acceptedAt } : {}),
    ...(item.queuedAt !== undefined ? { queuedAt: item.queuedAt } : {}),
    ...(item.failedAt !== undefined ? { failedAt: item.failedAt } : {}),
    ...(item.deadAt !== undefined ? { deadAt: item.deadAt } : {}),
    updatedAt: item.updatedAt,
    lease: projectChannelLeaseDiagnostic(item),
    ...(item.lastError !== undefined ? { lastError: projectChannelError(item.lastError) } : {}),
  };
}

function projectChannelActionTokenDiagnostic(
  token: ChannelActionToken,
  now: number,
): HarnessChannelDiagnostics['actionTokens'][number] {
  const status =
    token.revokedAt !== undefined
      ? 'revoked'
      : token.expiresAt !== undefined && token.expiresAt <= now
        ? 'expired'
        : 'active';
  return {
    actionTokenId: token.actionTokenId,
    status,
    channelId: token.channelId,
    providerId: token.providerId,
    bindingId: token.bindingId,
    bindingGeneration: token.bindingGeneration,
    resourceId: token.resourceId,
    owningSessionId: token.owningSessionId,
    itemId: token.itemId,
    kind: token.kind,
    runId: token.runId,
    pendingRequestedAt: token.pendingRequestedAt,
    ...(token.expiresAt !== undefined ? { expiresAt: token.expiresAt } : {}),
    ...(token.revokedAt !== undefined ? { revokedAt: token.revokedAt } : {}),
    ...(token.revokedReason !== undefined ? { revokedReason: token.revokedReason } : {}),
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  };
}

function projectChannelActionReceiptDiagnostic(
  receipt: ChannelActionReceipt,
): HarnessChannelDiagnostics['actionReceipts'][number] {
  return {
    id: receipt.id,
    status: receipt.status,
    channelId: receipt.channelId,
    providerId: receipt.providerId,
    actionTokenId: receipt.actionTokenId,
    actionId: receipt.actionId,
    bindingId: receipt.bindingId,
    bindingGeneration: receipt.bindingGeneration,
    resourceId: receipt.resourceId,
    owningSessionId: receipt.owningSessionId,
    itemId: receipt.itemId,
    kind: receipt.kind,
    runId: receipt.runId,
    pendingRequestedAt: receipt.pendingRequestedAt,
    ...(receipt.conflictReason !== undefined ? { conflictReason: receipt.conflictReason } : {}),
    ...(receipt.acceptedAt !== undefined ? { acceptedAt: receipt.acceptedAt } : {}),
    ...(receipt.appliedAt !== undefined ? { appliedAt: receipt.appliedAt } : {}),
    ...(receipt.failedAt !== undefined ? { failedAt: receipt.failedAt } : {}),
    ...(receipt.deadAt !== undefined ? { deadAt: receipt.deadAt } : {}),
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    lease: projectChannelLeaseDiagnostic(receipt),
    ...(receipt.lastError !== undefined ? { lastError: projectChannelError(receipt.lastError) } : {}),
  };
}

function projectChannelOutboxDiagnostic(item: ChannelOutboxItem): HarnessChannelDiagnostics['outbox'][number] {
  return {
    id: item.id,
    status: item.status,
    channelId: item.channelId,
    providerId: item.providerId,
    bindingId: item.bindingId,
    bindingGeneration: item.bindingGeneration,
    resourceId: item.resourceId,
    threadId: item.threadId,
    ...(item.sessionId !== undefined ? { sessionId: item.sessionId } : {}),
    ...(item.owningSessionId !== undefined ? { owningSessionId: item.owningSessionId } : {}),
    ...(item.source !== undefined
      ? { source: { kind: item.source.kind, ...(item.source.id ? { id: item.source.id } : {}) } }
      : {}),
    kind: item.kind,
    operationKind: item.operationKind,
    ...(item.operationName !== undefined ? { operationName: item.operationName } : {}),
    deliverySemantics: item.deliverySemantics,
    ...(item.sentAt !== undefined ? { sentAt: item.sentAt } : {}),
    ...(item.failedAt !== undefined ? { failedAt: item.failedAt } : {}),
    ...(item.deadAt !== undefined ? { deadAt: item.deadAt } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lease: projectChannelLeaseDiagnostic(item),
    ...(item.lastError !== undefined ? { lastError: projectChannelError(item.lastError) } : {}),
  };
}

export class Harness {
  private _ownerId?: string;

  /**
   * The Mastra instance backing this harness. Either supplied at
   * construction (`new Harness({ mastra })`), built internally from
   * inline `agents`/`storage`, or installed by `__registerMastra(parent)`
   * when the harness is registered as a child of a parent Mastra.
   *
   * Reads of agents and storage always go through this. Tools and
   * primitives that need the harness's Mastra (TUI, server) read it via
   * `harness.mastra`.
   */
  private _mastra?: Mastra;
  private _harnessName = 'default';
  private _registeredHarnessName?: string;
  private _hasAdoptedSessions = false;
  private _guardPreboundDefaultNamespace = false;
  private readonly _storageOverride?: HarnessStorage;
  private readonly _modesById: Map<string, HarnessMode>;
  private readonly _defaultModeId?: string;
  private readonly _liveSessions = new Map<string, Session>();
  private readonly _leaseTtlMs: number;
  private _leaseRenewalTimer?: ReturnType<typeof setInterval>;
  private _leaseRenewing = false;
  private readonly _maxQueueDepth: number;
  private readonly _queueBackpressure: HarnessQueueBackpressurePolicy;
  private readonly _closeTimeoutMs: number;
  private readonly _fileConfig: Readonly<HarnessFileConfig>;
  private readonly _subagentTypes: ReadonlyMap<string, SubagentDefinition>;
  private readonly _subagentMaxDepth: number;
  private readonly _goalDefaults: { defaultJudgeModel?: string; defaultMaxTurns: number };
  private readonly _defaultPermissionPolicy: PermissionPolicy;
  private readonly _toolCategoryResolver?: (toolName: string) => ToolCategory | null;
  private readonly _modelCatalog: ReadonlyMap<string, ModelInfo>;
  private readonly _modelAuthStatusResolver?: (modelId: string) => ModelAuthStatus | Promise<ModelAuthStatus>;
  private readonly _codeSkills: ReadonlyMap<string, HarnessSkill>;
  private readonly _channelRegistry: HarnessChannelRegistry;
  private readonly _runtimeCompatibilityGeneration?: string;
  private readonly _emitter = new EventEmitter();
  /** Per-session unsubscribers so harness-level subscribers see session events too. */
  private readonly _sessionEventBridges = new Map<string, HarnessEventUnsubscribe>();
  /** In-process session resolver de-dupe keyed by stable resolver identity. */
  private readonly _sessionResolvePromises = new Map<string, Promise<Session>>();
  /** In-process close de-dupe by any session id currently covered by a close tree. */
  private readonly _closePromises = new Map<string, Promise<void>>();
  /** Workspace registry — owns lifecycle across `shared`/`per-resource`/`per-session`. */
  readonly _workspaceRegistry: WorkspaceRegistry;
  /** Snapshot of the workspace kind for fast read paths. `undefined` when not configured. */
  readonly _workspaceKind?: 'shared' | 'per-resource' | 'per-session';
  private readonly _workspaceEager: boolean;
  private readonly _workspacePolicy?: WorkspacePolicy;
  private readonly _configuredHeartbeatHandlers: readonly HeartbeatHandler[];
  private readonly _heartbeatEntries = new Map<string, HeartbeatEntry>();
  private readonly _heartbeatRuns = new Map<symbol, TrackedHeartbeatWork>();
  private readonly _heartbeatRunContext = new AsyncLocalStorage<symbol>();
  private readonly _heartbeatShutdowns = new Map<symbol, TrackedHeartbeatWork>();
  private readonly _heartbeatShutdownContext = new AsyncLocalStorage<symbol>();

  private _initialized = false;
  private _initPromise?: Promise<void>;
  private _shutdown = false;

  constructor(config: HarnessConfig) {
    for (const key of Object.keys(config)) {
      if (!HARNESS_CONFIG_KNOWN_KEYS.has(key)) {
        console.warn(
          `[mastra:harness] ignoring unknown HarnessConfig key ${JSON.stringify(key)}. ` +
            `This will become a hard error in a future release.`,
        );
      }
    }
    const runtimeCompatibilityGeneration = config.runtimeCompatibilityGeneration;
    if (
      runtimeCompatibilityGeneration !== undefined &&
      (typeof runtimeCompatibilityGeneration !== 'string' || runtimeCompatibilityGeneration.trim().length === 0)
    ) {
      throw new HarnessConfigError('runtimeCompatibilityGeneration', 'must be a non-empty string when provided');
    }
    this._runtimeCompatibilityGeneration = runtimeCompatibilityGeneration?.trim();
    const configuredHeartbeatHandlers = (config.heartbeatHandlers ?? []).map(handler => Object.freeze({ ...handler }));
    const heartbeatHandlerIds = new Set<string>();
    for (const handler of configuredHeartbeatHandlers) {
      this.assertHeartbeatHandler(handler);
      if (heartbeatHandlerIds.has(handler.id)) {
        throw new HarnessConfigError(`heartbeatHandlers["${handler.id}"]`, 'duplicate heartbeat handler id');
      }
      heartbeatHandlerIds.add(handler.id);
    }
    this._configuredHeartbeatHandlers = Object.freeze(configuredHeartbeatHandlers);
    this._leaseTtlMs = DEFAULT_LEASE_TTL_MS;
    this._storageOverride = config.sessions?.storage;
    this._maxQueueDepth = config.sessions?.maxQueueDepth ?? DEFAULT_MAX_QUEUE_DEPTH;
    if (this._maxQueueDepth < 1) {
      throw new HarnessConfigError('sessions.maxQueueDepth', 'must be a positive integer');
    }
    this._queueBackpressure = config.sessions?.queueBackpressure ?? 'reject';
    if (this._queueBackpressure !== 'reject' && this._queueBackpressure !== 'drop-oldest') {
      throw new HarnessConfigError('sessions.queueBackpressure', 'must be "reject" or "drop-oldest"');
    }
    this._closeTimeoutMs = config.sessions?.closeTimeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS;
    if (
      !Number.isInteger(this._closeTimeoutMs) ||
      this._closeTimeoutMs < 1 ||
      this._closeTimeoutMs > MAX_CLOSE_TIMEOUT_MS
    ) {
      throw new HarnessConfigError(
        'sessions.closeTimeoutMs',
        `must be a positive integer no greater than ${MAX_CLOSE_TIMEOUT_MS}`,
      );
    }
    const normalizedFileConfig: HarnessFileConfig = {
      ...(config.files ?? {}),
      ...(config.files?.allowedUrlMimeTypes
        ? { allowedUrlMimeTypes: Object.freeze([...config.files.allowedUrlMimeTypes]) }
        : {}),
    };
    if (
      normalizedFileConfig.allowPrivateNetworkUrls !== undefined &&
      typeof normalizedFileConfig.allowPrivateNetworkUrls !== 'boolean'
    ) {
      throw new HarnessConfigError('files.allowPrivateNetworkUrls', 'must be a boolean');
    }
    for (const [key, value] of Object.entries(normalizedFileConfig)) {
      if (key === 'allowPrivateNetworkUrls' || key === 'allowedUrlMimeTypes') continue;
      if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value) || value < 0)) {
        throw new HarnessConfigError(`files.${key}`, 'must be a non-negative integer');
      }
    }
    if (
      normalizedFileConfig.allowedUrlMimeTypes !== undefined &&
      (!Array.isArray(normalizedFileConfig.allowedUrlMimeTypes) ||
        normalizedFileConfig.allowedUrlMimeTypes.some(value => typeof value !== 'string' || value.length === 0))
    ) {
      throw new HarnessConfigError('files.allowedUrlMimeTypes', 'must be an array of non-empty strings');
    }
    this._fileConfig = Object.freeze(normalizedFileConfig);

    // Subagent registry. Shape validation up front (uniqueness, mutual
    // exclusion of tool overlays); agent-existence resolution happens at
    // _bindMastra so it matches how modes are validated.
    const subagentTypes = new Map<string, SubagentDefinition>();
    if (config.subagents) {
      for (const [agentType, def] of Object.entries(config.subagents.types ?? {})) {
        if (typeof def?.agentId !== 'string' || def.agentId.length === 0) {
          throw new HarnessConfigError(`subagents.types["${agentType}"].agentId`, 'is required');
        }
        if (typeof def.description !== 'string' || def.description.length === 0) {
          throw new HarnessConfigError(`subagents.types["${agentType}"].description`, 'is required');
        }
        if (def.forked !== undefined && typeof def.forked !== 'boolean') {
          throw new HarnessConfigError(`subagents.types["${agentType}"].forked`, 'must be a boolean when provided');
        }
        subagentTypes.set(agentType, def);
      }
      this._subagentMaxDepth = config.subagents.maxDepth ?? DEFAULT_SUBAGENT_MAX_DEPTH;
      if (this._subagentMaxDepth < 1) {
        throw new HarnessConfigError('subagents.maxDepth', 'must be a positive integer');
      }
    } else {
      this._subagentMaxDepth = DEFAULT_SUBAGENT_MAX_DEPTH;
    }
    this._subagentTypes = subagentTypes;

    // Goal-loop defaults (§4.7). Optional; resolved per-call at setGoal().
    const goalsCfg = config.goals;
    if (goalsCfg?.defaultMaxTurns !== undefined && goalsCfg.defaultMaxTurns < 1) {
      throw new HarnessConfigError('goals.defaultMaxTurns', 'must be a positive integer');
    }
    this._goalDefaults = {
      ...(goalsCfg?.defaultJudgeModel !== undefined ? { defaultJudgeModel: goalsCfg.defaultJudgeModel } : {}),
      defaultMaxTurns: goalsCfg?.defaultMaxTurns ?? DEFAULT_GOAL_MAX_TURNS,
    };

    // Permission gate config (§4.2e).
    if (
      config.defaultPermissionPolicy !== undefined &&
      config.defaultPermissionPolicy !== 'allow' &&
      config.defaultPermissionPolicy !== 'ask' &&
      config.defaultPermissionPolicy !== 'deny'
    ) {
      throw new HarnessConfigError(
        'defaultPermissionPolicy',
        `must be one of 'allow' | 'ask' | 'deny' (received: ${JSON.stringify(config.defaultPermissionPolicy)})`,
      );
    }
    if (config.toolCategoryResolver !== undefined && typeof config.toolCategoryResolver !== 'function') {
      throw new HarnessConfigError('toolCategoryResolver', 'must be a function');
    }
    if (
      config.toolCategories !== undefined &&
      (typeof config.toolCategories !== 'object' ||
        config.toolCategories === null ||
        Array.isArray(config.toolCategories))
    ) {
      throw new HarnessConfigError('toolCategories', 'must be a Record<string, ToolCategory>');
    }
    this._defaultPermissionPolicy = config.defaultPermissionPolicy ?? DEFAULT_PERMISSION_POLICY;
    // `toolCategoryResolver` is primary; `toolCategories` is sugar that
    // desugars to `(name) => toolCategories[name] ?? null`. When both are
    // provided the resolver wins (§9.1 sugar contract).
    if (config.toolCategoryResolver) {
      this._toolCategoryResolver = config.toolCategoryResolver;
    } else if (config.toolCategories) {
      const map = config.toolCategories;
      this._toolCategoryResolver = (name: string) => map[name] ?? null;
    } else {
      this._toolCategoryResolver = undefined;
    }

    // Model catalog (§9). Static list of `ModelInfo`; ids must be unique
    // within the catalog. The catalog is independent of modes — modes may
    // reference models outside the catalog, and the catalog may include
    // models not bound to any mode. Pure UX surface.
    const catalog = new Map<string, ModelInfo>();
    if (config.models) {
      if (!Array.isArray(config.models)) {
        throw new HarnessConfigError('models', 'must be an array of ModelInfo');
      }
      for (const entry of config.models) {
        if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) {
          throw new HarnessConfigError('models', 'every entry must have a non-empty string `id`');
        }
        if (typeof entry.providerId !== 'string' || entry.providerId.length === 0) {
          throw new HarnessConfigError('models', `entry "${entry.id}" must have a non-empty string \`providerId\``);
        }
        if (catalog.has(entry.id)) {
          throw new HarnessConfigError('models', `duplicate model id "${entry.id}"`);
        }
        catalog.set(entry.id, entry);
      }
    }
    this._modelCatalog = catalog;
    this._modelAuthStatusResolver = config.modelAuthStatusResolver;

    // Code-registered skills (§4.6 / §9). Static deployment catalog; session
    // workspace skills are layered after these and lose on name conflicts.
    const codeSkills = new Map<string, HarnessSkill>();
    if (config.skills !== undefined) {
      if (!Array.isArray(config.skills)) {
        throw new HarnessConfigError('skills', 'must be an array of HarnessSkill');
      }
      for (const entry of config.skills) {
        if (!entry || typeof entry.name !== 'string' || entry.name.length === 0) {
          throw new HarnessConfigError('skills', 'every entry must have a non-empty string `name`');
        }
        if (typeof entry.description !== 'string') {
          throw new HarnessConfigError('skills', `entry "${entry.name}" must have a string \`description\``);
        }
        if (typeof entry.instructions !== 'string') {
          throw new HarnessConfigError('skills', `entry "${entry.name}" must have a string \`instructions\``);
        }
        if (entry.category !== undefined && typeof entry.category !== 'string') {
          throw new HarnessConfigError('skills', `entry "${entry.name}" must have a string \`category\``);
        }
        if (entry.filePath !== undefined && (typeof entry.filePath !== 'string' || entry.filePath.length === 0)) {
          throw new HarnessConfigError('skills', `entry "${entry.name}" must have a non-empty string \`filePath\``);
        }
        if (entry.action !== undefined) {
          assertHarnessSkillActionMetadata(entry.action, entry.name);
        }
        if (entry.metadata !== undefined && !isPlainSkillMetadata(entry.metadata)) {
          throw new HarnessConfigError('skills', `entry "${entry.name}" must have object \`metadata\``);
        }
        if (
          entry.metadata !== undefined &&
          !hasOnlyCloneableSkillMetadataValues(entry.metadata, new WeakSet<object>())
        ) {
          throw new HarnessConfigError(
            'skills',
            `entry "${entry.name}" metadata must contain only primitives, arrays, and plain objects`,
          );
        }
        if (codeSkills.has(entry.name)) {
          throw new HarnessConfigError('skills', `duplicate skill name "${entry.name}"`);
        }
        codeSkills.set(entry.name, cloneHarnessSkill(entry));
      }
    }
    this._codeSkills = codeSkills;

    this._channelRegistry = new HarnessChannelRegistry(config.channels);

    // Workspace (§2.7). Three ownership models; registry handles lifecycle.
    // Cross-checks against the subagent registry happen below.
    this._workspaceKind = config.workspace?.kind;
    this._workspaceEager = Boolean(config.workspace?.eager);
    this._workspacePolicy = config.workspace?.policy;
    this._workspaceRegistry = new WorkspaceRegistry({
      config: config.workspace,
      emitter: this._emitter,
    });

    // Subagent `workspace: 'fresh'` is only valid under `per-session`. Validate
    // at config time so misconfigurations don't reach the runtime spawn path.
    if (this._workspaceKind !== 'per-session') {
      for (const [agentType, def] of subagentTypes) {
        if (def.workspace === 'fresh') {
          throw new HarnessConfigError(
            `subagents.types["${agentType}"].workspace`,
            `"fresh" requires harness workspace kind "per-session" (current: "${this._workspaceKind ?? 'unconfigured'}")`,
          );
        }
      }
    }

    // Validate mode shape (uniqueness, tools/additionalTools mutual
    // exclusion, transitionsTo resolution) up front. Agent-existence
    // validation happens once a Mastra is bound — either here (if the
    // caller supplied one) or in __registerMastra.
    this._modesById = new Map();
    for (const mode of config.modes ?? []) {
      if (this._modesById.has(mode.id)) {
        throw new HarnessConfigError(`modes`, `duplicate mode id "${mode.id}"`);
      }
      if (mode.tools && mode.additionalTools) {
        throw new HarnessConfigError(
          `modes[${mode.id}]`,
          `cannot set both "tools" and "additionalTools" — choose replace OR augment`,
        );
      }
      this._modesById.set(mode.id, mode);
    }
    for (const mode of this._modesById.values()) {
      if (mode.transitionsTo && !this._modesById.has(mode.transitionsTo)) {
        throw new HarnessConfigError(
          `modes[${mode.id}].transitionsTo`,
          `references unknown mode "${mode.transitionsTo}"`,
        );
      }
    }

    if (config.defaultModeId !== undefined) {
      if (!this._modesById.has(config.defaultModeId)) {
        throw new HarnessConfigError(`defaultModeId`, `references unknown mode "${config.defaultModeId}"`);
      }
      this._defaultModeId = config.defaultModeId;
    } else if (this._modesById.size > 0) {
      throw new HarnessConfigError(`defaultModeId`, `must be set when "modes" is non-empty`);
    }

    // Resolve the Mastra binding. Three shapes:
    //   1. Caller passed a pre-built Mastra
    //   2. Caller passed inline agents (and optionally storage) — we build
    //      our own Mastra so the harness is fully self-contained. If no
    //      storage was supplied we default to InMemoryStore so that both
    //      the harness storage domain *and* the memory domain (used by
    //      thread CRUD) are available without the caller having to wire
    //      a composite by hand.
    //   3. Neither — defer; a parent Mastra will install itself via
    //      __registerMastra during its own construction.
    if (config.mastra) {
      this._bindMastra(config.mastra);
    } else if (config.agents !== undefined || config.storage !== undefined) {
      if (this._channelRegistry.hasPending()) {
        throw new HarnessConfigError(
          'channels',
          'channel bindings require a Mastra with channel providers; pass `mastra` or register the harness on a parent Mastra',
        );
      }
      const storage = config.storage ?? new InMemoryStore();
      const internal = new Mastra({
        agents: config.agents,
        storage,
      });
      this._bindMastra(internal);
    }
    // Otherwise: stay unbound. session() will throw HarnessConfigError
    // with a clear message until the parent Mastra registers.
  }

  /** Process-scoped owner id used as the lease holder for all sessions. */
  get ownerId(): string {
    this._ownerId ??= `harness-${randomUUID()}`;
    return this._ownerId;
  }

  /**
   * The Mastra instance powering this harness. Throws if the harness has
   * not been bound to a Mastra yet (i.e., it was constructed with no
   * `mastra` / `agents` / `storage` and has not been registered onto a
   * parent Mastra). Once bound, the reference is stable for the harness's
   * lifetime.
   */
  get mastra(): Mastra {
    if (!this._mastra) {
      throw new HarnessConfigError(
        'mastra',
        'harness is not yet bound to a Mastra — pass `mastra`/`agents`/`storage` at construction or register it on a parent Mastra',
      );
    }
    return this._mastra;
  }

  /**
   * Mastra lifecycle readiness hook. Validates that the harness is bound and
   * materializes eager shared workspace dependencies before server routes are
   * admitted.
   */
  async init(): Promise<void> {
    if (this._shutdown) {
      throw new HarnessConfigError('shutdown', 'harness cannot be initialized after shutdown');
    }
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._initOnce();
    try {
      await this._initPromise;
    } catch (error) {
      this._initPromise = undefined;
      throw error;
    }
  }

  private async _initOnce(): Promise<void> {
    // Accessor intentionally provides the existing bound-Mastra error shape.
    this.mastra;

    let acquiredSharedWorkspace = false;
    if (this._workspaceKind === 'shared' && this._workspaceEager) {
      try {
        await this._workspaceRegistry.acquireShared();
      } catch (error) {
        if (this._shutdown) {
          throw new HarnessConfigError('shutdown', 'harness cannot be initialized after shutdown');
        }
        throw error;
      }
      acquiredSharedWorkspace = true;
    }

    if (this._shutdown) {
      if (acquiredSharedWorkspace) {
        await this._workspaceRegistry.destroyShared();
      }
      throw new HarnessConfigError('shutdown', 'harness cannot be initialized after shutdown');
    }

    this.startConfiguredHeartbeats();
    this._initialized = true;
  }

  private startConfiguredHeartbeats(): void {
    const startedIds: string[] = [];
    try {
      for (const handler of this._configuredHeartbeatHandlers) {
        this.registerHeartbeatEntry(handler, 'heartbeatHandlers');
        startedIds.push(handler.id);
      }
    } catch (error) {
      for (const id of startedIds) {
        const entry = this.clearHeartbeatEntry(id);
        if (entry) {
          void this.startHeartbeatShutdown(id, entry);
        }
      }
      throw error;
    }
  }

  /**
   * Register and start a heartbeat immediately. Re-registering the same id
   * clears the old timer and starts the new one while the previous shutdown
   * callback is queued in the background. Configured handlers that have not
   * started yet are still controlled by `heartbeatHandlers` config. Replacement
   * does not wait for the previous shutdown before starting the new timer, and
   * ticks are not serialized; handlers should be safe to run concurrently if a
   * previous tick is still pending. When `init()` starts configured handlers,
   * configured ids take precedence over direct pre-init registrations.
   */
  registerHeartbeat(handler: HeartbeatHandler): void {
    this.registerHeartbeatEntry(handler, 'registerHeartbeat');
  }

  private registerHeartbeatEntry(
    handler: HeartbeatHandler,
    validationPath: 'registerHeartbeat' | 'heartbeatHandlers',
  ): void {
    if (this._shutdown) {
      throw new HarnessConfigError('shutdown', 'harness cannot register heartbeat handlers after shutdown');
    }
    this.assertHeartbeatHandler(handler, validationPath);

    const previous = this.clearHeartbeatEntry(handler.id);
    if (previous) {
      void this.startHeartbeatShutdown(handler.id, previous);
    }

    const run = () => {
      const runId = Symbol(`heartbeat:${handler.id}`);
      const runPromise = this._heartbeatRunContext.run(runId, async () => {
        try {
          await handler.handler();
        } catch (error) {
          console.error(`[Heartbeat:${handler.id}] failed:`, error);
        }
      });
      void this.trackHeartbeatRun(runId, runPromise);
      return runPromise;
    };

    const timer = setInterval(run, handler.intervalMs);
    timer.unref?.();
    this._heartbeatEntries.set(handler.id, { timer, shutdown: handler.shutdown });

    if (handler.immediate !== false) {
      void run();
    }
  }

  private assertHeartbeatHandler(handler: HeartbeatHandler, path = 'heartbeatHandlers'): void {
    if (!handler || typeof handler !== 'object') {
      throw new HarnessConfigError(path, 'every entry must be an object');
    }
    if (typeof handler.id !== 'string' || handler.id.length === 0) {
      throw new HarnessConfigError(`${path}.id`, 'must be a non-empty string');
    }
    if (!Number.isFinite(handler.intervalMs) || handler.intervalMs <= 0) {
      throw new HarnessConfigError(`${path}["${handler.id}"].intervalMs`, 'must be a positive number');
    }
    if (typeof handler.handler !== 'function') {
      throw new HarnessConfigError(`${path}["${handler.id}"].handler`, 'must be a function');
    }
    if (handler.shutdown !== undefined && typeof handler.shutdown !== 'function') {
      throw new HarnessConfigError(`${path}["${handler.id}"].shutdown`, 'must be a function when provided');
    }
  }

  /**
   * Remove a running heartbeat by id. This does not remove a configured
   * handler that has not started yet during `init()`.
   */
  async removeHeartbeat({ id }: { id: string }): Promise<void> {
    const entry = this.clearHeartbeatEntry(id);
    if (!entry) return;
    await this.startHeartbeatShutdown(id, entry);
  }

  /**
   * Stop the currently running heartbeat snapshot. Later registrations can
   * still start new heartbeats unless the harness is shutting down. Calling
   * this before `init()` does not disable configured handlers; neither does
   * calling it while `init()` is still pending and configured handlers have not
   * started yet. After successful init has completed, this permanently stops
   * configured handlers for this harness instance, and a later `init()` call
   * does not restart them. This does not lock out concurrent direct
   * `registerHeartbeat()` calls outside `shutdown()`.
   */
  async stopHeartbeats(): Promise<void> {
    const entries = [...this._heartbeatEntries.entries()];
    this._heartbeatEntries.clear();

    const entryShutdowns = entries.map(([id, entry]) => {
      clearInterval(entry.timer);
      return this.startHeartbeatShutdown(id, entry);
    });
    const currentRunId = this._heartbeatRunContext.getStore();
    const currentShutdownId = this._heartbeatShutdownContext.getStore();
    const currentRun = currentRunId === undefined ? undefined : this._heartbeatRuns.get(currentRunId);
    currentRun?.markEnteredStop();
    const currentShutdown =
      currentShutdownId === undefined ? undefined : this._heartbeatShutdowns.get(currentShutdownId);
    currentShutdown?.markEnteredStop();
    const inFlightRuns = this.snapshotHeartbeatWork(this._heartbeatRuns, currentRunId);
    const pendingShutdowns = this.snapshotHeartbeatWork(this._heartbeatShutdowns, currentShutdownId);
    await Promise.all([...entryShutdowns, ...pendingShutdowns, ...inFlightRuns]);
  }

  private snapshotHeartbeatWork(entries: Map<symbol, TrackedHeartbeatWork>, currentId?: symbol): Promise<void>[] {
    return [...entries.entries()]
      .filter(([id]) => id !== currentId)
      .map(([, entry]) => (currentId === undefined ? entry.promise : Promise.race([entry.promise, entry.enteredStop])));
  }

  private clearHeartbeatEntry(id: string): HeartbeatEntry | undefined {
    const entry = this._heartbeatEntries.get(id);
    if (!entry) return undefined;
    clearInterval(entry.timer);
    this._heartbeatEntries.delete(id);
    return entry;
  }

  private async runHeartbeatShutdown(id: string, entry: HeartbeatEntry): Promise<void> {
    try {
      await entry.shutdown?.();
    } catch (error) {
      console.error(`[Heartbeat:${id}] shutdown failed:`, error);
    }
  }

  private startHeartbeatShutdown(id: string, entry: HeartbeatEntry): Promise<void> {
    const shutdownId = Symbol(`heartbeat-shutdown:${id}`);
    const shutdown = this._heartbeatShutdownContext.run(shutdownId, () => this.runHeartbeatShutdown(id, entry));
    const tracked = this.trackHeartbeatWork(shutdown);
    this._heartbeatShutdowns.set(shutdownId, tracked);
    return shutdown.finally(() => {
      if (this._heartbeatShutdowns.get(shutdownId) === tracked) {
        this._heartbeatShutdowns.delete(shutdownId);
      }
    });
  }

  private trackHeartbeatRun(runId: symbol, run: Promise<void>): Promise<void> {
    const tracked = this.trackHeartbeatWork(run);
    this._heartbeatRuns.set(runId, tracked);
    return run.finally(() => {
      if (this._heartbeatRuns.get(runId) === tracked) {
        this._heartbeatRuns.delete(runId);
      }
    });
  }

  private trackHeartbeatWork(promise: Promise<void>): TrackedHeartbeatWork {
    let markEnteredStop!: () => void;
    const enteredStop = new Promise<void>(resolve => {
      markEnteredStop = resolve;
    });
    return { promise, enteredStop, markEnteredStop };
  }

  /**
   * @internal — called by `Mastra` during its own construction when this
   * harness is registered under `harnesses.<name>`. Idempotent for the
   * same parent; throws if called twice with different parents.
   */
  __registerMastra(mastra: Mastra, harnessName?: string): void {
    if (this._mastra && this._mastra !== mastra) {
      throw new HarnessConfigError('mastra', 'harness is already bound to a different Mastra instance');
    }

    if (harnessName !== undefined) {
      if (this._registeredHarnessName !== undefined && harnessName !== this._registeredHarnessName) {
        throw new HarnessConfigError('mastra', 'harness is already registered under a different harness name');
      }
      if (this._registeredHarnessName === undefined && harnessName !== this._harnessName && this._hasAdoptedSessions) {
        throw new HarnessConfigError(
          'mastra',
          'harness already has sessions under the default harness name and cannot be renamed',
        );
      }
    }

    if (this._mastra === mastra) {
      if (harnessName !== undefined) {
        const previousHarnessName = this._harnessName;
        const previousRegisteredHarnessName = this._registeredHarnessName;
        const previousGuardPreboundDefaultNamespace = this._guardPreboundDefaultNamespace;
        if (this._registeredHarnessName === undefined && this._harnessName === 'default' && harnessName !== 'default') {
          this._guardPreboundDefaultNamespace = true;
        }
        this._harnessName = harnessName;
        this._registeredHarnessName = harnessName;
        try {
          this._channelRegistry.bind(mastra, this._harnessName);
        } catch (err) {
          this._harnessName = previousHarnessName;
          this._registeredHarnessName = previousRegisteredHarnessName;
          this._guardPreboundDefaultNamespace = previousGuardPreboundDefaultNamespace;
          this._channelRegistry.bind(mastra, previousHarnessName);
          throw err;
        }
      }
      return;
    }

    const previousHarnessName = this._harnessName;
    const previousRegisteredHarnessName = this._registeredHarnessName;
    const previousGuardPreboundDefaultNamespace = this._guardPreboundDefaultNamespace;
    if (harnessName !== undefined) {
      this._harnessName = harnessName;
      this._registeredHarnessName = harnessName;
    }
    try {
      this._bindMastra(mastra);
    } catch (err) {
      this._harnessName = previousHarnessName;
      this._registeredHarnessName = previousRegisteredHarnessName;
      this._guardPreboundDefaultNamespace = previousGuardPreboundDefaultNamespace;
      throw err;
    }
  }

  /**
   * Validate every mode's `agentId` against the Mastra's agent registry
   * and stash the binding for runtime use.
   */
  private _bindMastra(mastra: Mastra): void {
    for (const mode of this._modesById.values()) {
      let agent: Agent | undefined;
      try {
        agent = mastra.getAgent(mode.agentId as never) as Agent | undefined;
      } catch {
        agent = undefined;
      }
      if (!agent) {
        throw new HarnessConfigError(
          `modes[${mode.id}].agentId`,
          `references unknown agent "${mode.agentId}" — Mastra has no such agent registered`,
        );
      }
    }
    for (const [agentType, def] of this._subagentTypes) {
      let agent: Agent | undefined;
      try {
        agent = mastra.getAgent(def.agentId as never) as Agent | undefined;
      } catch {
        agent = undefined;
      }
      if (!agent) {
        throw new HarnessConfigError(
          `subagents.types["${agentType}"].agentId`,
          `references unknown agent "${def.agentId}" — Mastra has no such agent registered`,
        );
      }
      if (def.modeId !== undefined && !this._modesById.has(def.modeId)) {
        throw new HarnessConfigError(
          `subagents.types["${agentType}"].modeId`,
          `references unknown mode "${def.modeId}"`,
        );
      }
    }
    let boundHarnesses = boundHarnessesByMastra.get(mastra);
    if (!boundHarnesses) {
      boundHarnesses = new Set();
      boundHarnessesByMastra.set(mastra, boundHarnesses);
    }
    boundHarnesses.add(this);
    this._mastra = mastra;
    try {
      this._channelRegistry.bind(mastra, this._harnessName);
      this._trackMemoryStorage(mastra.getStorage()?.stores?.memory);
    } catch (err) {
      boundHarnesses.delete(this);
      this._mastra = undefined;
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Events — §10.
  // -------------------------------------------------------------------------

  /**
   * Subscribe to harness-scoped events. Includes lifecycle events for every
   * live session (session_created, session_closing, session_closed,
   * session_evicted) and any harness-level custom events. Per-session turn
   * events (agent_start, message_*, tool_*, suspension_*, mode_changed,
   * model_changed) are forwarded here so a single subscriber can render the
   * whole harness.
   * Per-turn events also include `message_*` (assistant text streaming) and
   * `tool_input_*` (model-side argument streaming) — see §10.2.
   *
   * Listeners see only future events.
   */
  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this._emitter.subscribe(listener);
  }

  /** @internal — listener count for tests. */
  _internalListenerCount(): number {
    return this._emitter.listenerCount;
  }

  // -------------------------------------------------------------------------
  // Workspace — §2.7 / §4.1.
  // -------------------------------------------------------------------------

  /**
   * Returns the shared workspace when the harness is configured with
   * `kind: 'shared'`. For `per-resource` and `per-session`, returns
   * `undefined` — those models don't have a meaningful harness-level
   * workspace. Tools should always go through `session.getWorkspace()`.
   *
   * The shared workspace materialises lazily on first call (or eagerly
   * during `init()` when `eager: true`).
   */
  async getWorkspace(): Promise<Workspace | undefined> {
    if (this._workspaceKind !== 'shared') return undefined;
    return this._workspaceRegistry.acquireShared();
  }

  /**
   * Tear down the workspace bound to a given resource. Only valid under
   * `kind: 'per-resource'`. Throws `HarnessWorkspaceInUseError` if any
   * sessions are still holding the workspace; callers are expected to
   * close them first.
   */
  async destroyResourceWorkspace(opts: { resourceId: string }): Promise<void> {
    if (this._workspaceKind !== 'per-resource') {
      throw new HarnessConfigError(
        'workspace.kind',
        `destroyResourceWorkspace requires kind: "per-resource" (current: "${this._workspaceKind ?? 'unconfigured'}")`,
      );
    }
    await this._workspaceRegistry.destroyResourceWorkspace(opts);
  }

  /** @internal — emit a harness-level event. Used by tests and helpers. */
  _emit(event: Parameters<EventEmitter['emit']>[0], overrides?: Parameters<EventEmitter['emit']>[1]): HarnessEvent {
    return this._emitter.emit(event, overrides);
  }

  /**
   * Resolve the backing `Agent` for a mode through the bound Mastra.
   * Throws if the harness is not yet bound.
   */
  getAgentForMode(modeId: string): Agent {
    const mode = this._modesById.get(modeId);
    if (!mode) {
      throw new HarnessConfigError('modeId', `unknown mode "${modeId}"`);
    }
    const mastra = this.mastra;
    let agent: Agent | undefined;
    try {
      agent = mastra.getAgent(mode.agentId as never) as Agent | undefined;
    } catch {
      agent = undefined;
    }
    if (!agent) {
      throw new HarnessConfigError(
        `modes[${mode.id}].agentId`,
        `references unknown agent "${mode.agentId}" — Mastra has no such agent registered`,
      );
    }
    return agent;
  }

  /** @internal — capture stable runtime ids for work that may be recovered after restart. */
  _runtimeDependenciesForMode(modeId: string, modelId?: string): HarnessRuntimeDependencyRefs {
    const mode = this._getMode(modeId);
    return {
      modeId,
      agentId: mode.agentId,
      ...(this._runtimeCompatibilityGeneration
        ? { runtimeCompatibilityGeneration: this._runtimeCompatibilityGeneration }
        : {}),
      ...(modelId ? { modelId } : {}),
      workspaceProviderId: this._workspaceDependencyId(),
    };
  }

  /** @internal — validate persisted runtime ids before recovered work invokes an agent. */
  _resolveAgentForRuntimeDependencies(
    refs: HarnessRuntimeDependencyRefs,
    context: string,
  ): { mode: HarnessMode; agent: Agent } {
    const mode = this._modesById.get(refs.modeId);
    if (!mode) {
      throw new HarnessRuntimeDependencyDriftError('mode', refs.modeId, 'is not registered on this harness', context);
    }
    if (refs.agentId !== undefined && refs.agentId !== mode.agentId) {
      throw new HarnessRuntimeDependencyDriftError(
        'agent',
        refs.agentId,
        `was recorded for mode "${refs.modeId}", but the mode now points at agent "${mode.agentId}"`,
        context,
      );
    }
    const agentId = refs.agentId ?? mode.agentId;
    const mastra = this.mastra;
    let agent: Agent | undefined;
    try {
      agent = mastra.getAgent(agentId as never) as Agent | undefined;
    } catch {
      agent = undefined;
    }
    if (!agent) {
      throw new HarnessRuntimeDependencyDriftError(
        'agent',
        agentId,
        'is not registered on this Mastra instance',
        context,
      );
    }
    if (
      refs.runtimeCompatibilityGeneration !== undefined &&
      refs.runtimeCompatibilityGeneration !== this._runtimeCompatibilityGeneration
    ) {
      throw new HarnessRuntimeDependencyDriftError(
        'runtime_compatibility_generation',
        refs.runtimeCompatibilityGeneration,
        `was recorded, but the current generation is "${this._runtimeCompatibilityGeneration ?? 'unconfigured'}"`,
        context,
      );
    }
    if ('workspaceProviderId' in refs && this._workspaceDependencyId() !== refs.workspaceProviderId) {
      throw new HarnessRuntimeDependencyDriftError(
        'workspace_provider',
        refs.workspaceProviderId ?? 'unconfigured',
        `was recorded, but the current workspace dependency is "${this._workspaceDependencyId() ?? 'unconfigured'}"`,
        context,
      );
    }
    return { mode, agent };
  }

  private _workspaceDependencyId(): string | null {
    if (this._workspaceKind === undefined) return null;
    if (this._workspaceKind === 'shared') return `shared:${this.ownerId}`;
    return this._workspaceRegistry.providerId ?? null;
  }

  /**
   * @internal — Session reads the subagent-type registry when wiring
   * the built-in `spawn_subagent` tool. Returns undefined for unknown
   * types so the tool can return a `HarnessValidationError`-shaped
   * payload rather than throwing through the agent stream.
   */
  _getSubagentType(agentType: string): SubagentDefinition | undefined {
    return this._subagentTypes.get(agentType);
  }

  /** @internal — Session reads this to render the `agentType` enum in the spawn tool's input schema. */
  _listSubagentTypeIds(): string[] {
    return Array.from(this._subagentTypes.keys());
  }

  /** @internal — Session merges static skills before workspace-discovered skills. */
  _listCodeSkills(): HarnessSkill[] {
    return Array.from(this._codeSkills.values()).map(cloneHarnessSkill);
  }

  /** @internal — Session resolves code-registered skills by name. */
  _getCodeSkill(ref: string): HarnessSkill | undefined {
    const byName = this._codeSkills.get(ref);
    if (byName) return cloneHarnessSkill(byName);
    return undefined;
  }

  /** @internal — Session reads registered MCP servers for read-only desktop catalogs. */
  _listMcpServers(): Array<[string, MCPServerBase]> {
    const servers = this.mastra.listMCPServers();
    if (!servers) return [];
    return Object.entries(servers);
  }

  /** @internal — Session resolves one registered MCP server by Mastra registration key. */
  _getMcpServer(key: string): MCPServerBase | undefined {
    const server = this.mastra.getMCPServer(key as never) as unknown;
    return server instanceof MCPServerBase ? server : undefined;
  }

  /**
   * @internal — list registered MCP server keys for the workspace-action
   * classifier. Used to detect `<serverKey>_<toolName>` namespaced tool
   * names emitted by `MCPClient.listTools()` and journal them with
   * `actionKind: 'mcp'`. Returns an empty array when no MCP servers are
   * registered; callers must tolerate that.
   */
  _listMcpServerKeys(): string[] {
    return this._listMcpServers().map(([key]) => key);
  }

  /** @internal — Session enforces the subagent depth cap inside the spawn tool. */
  _getSubagentMaxDepth(): number {
    return this._subagentMaxDepth;
  }

  /** @internal — Session reads the resolved mode for per-turn overlays. */
  _getMode(modeId: string): HarnessMode {
    const mode = this._modesById.get(modeId);
    if (!mode) {
      throw new HarnessConfigError('modeId', `unknown mode "${modeId}"`);
    }
    return mode;
  }

  /**
   * Enumerate every mode registered on this harness, in declaration order.
   *
   * Returned array is a fresh copy — callers may sort or filter without
   * affecting harness state. Used by TUIs to render a mode picker and by
   * scripts that need to discover what modes exist before opening a session.
   */
  listModes(): HarnessMode[] {
    return Array.from(this._modesById.values());
  }

  /**
   * Look up a single mode by id. Returns `undefined` if no mode with that id
   * is registered. For the throwing variant used during request resolution,
   * see the internal `_getMode` helper.
   */
  getMode(modeId: string): HarnessMode | undefined {
    return this._modesById.get(modeId);
  }

  /**
   * Enumerate Harness channel bindings after the harness is bound to Mastra.
   * Once parent registration completes, the returned durable ids include the
   * resolved harness namespace and are stable inputs for later route, ingress,
   * and outbox workers.
   */
  listChannelBindings(): HarnessChannelBinding[] {
    void this.mastra;
    return this._channelRegistry.list();
  }

  /**
   * Look up one registered Harness channel binding by `channelId`.
   */
  getChannelBinding(channelId: string): HarnessChannelBinding | undefined {
    void this.mastra;
    return this._channelRegistry.get(channelId);
  }

  /**
   * Return read-only, redacted diagnostics for channel ledger rows visible to a
   * session. This method delegates to the storage read-only diagnostics contract
   * and never claims, retries, dispatches, or reconciles work.
   */
  async getChannelDiagnostics(opts: HarnessChannelDiagnosticsOptions): Promise<HarnessChannelDiagnostics | null> {
    const storage = this._requireStorage('getChannelDiagnostics()');
    const root = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!root || root.resourceId !== opts.resourceId) return null;

    const visibleSessions = await this._visibleChannelDiagnosticSessionIds(root);
    const limit = resolveChannelDiagnosticsLimit(opts.limit);
    const rows = await storage.listChannelDiagnosticsRows({
      harnessName: this._harnessName,
      resourceId: opts.resourceId,
      sessionIds: visibleSessions.sessionIds,
      limit: limit + 1,
    });
    return projectChannelDiagnostics(
      root,
      this.listChannelBindings(),
      rows,
      visibleSessions.sessionIds,
      limit,
      visibleSessions.truncated,
    );
  }

  channels = {
    diagnostics: (opts: HarnessChannelDiagnosticsOptions): Promise<HarnessChannelDiagnostics | null> =>
      this.getChannelDiagnostics(opts),

    enqueueOutbox: async (
      opts: ChannelOutboxEnqueueOptions,
    ): Promise<{
      outboxItemId: string;
      duplicate: boolean;
      conflict: boolean;
    }> => {
      const storage = this._requireStorage('channels.enqueueOutbox()');
      const { binding, config } = this._requireChannelRuntime(opts.channelId);
      const provider = this._requireChannelProvider(binding);
      if (opts.target.platform !== binding.platform) {
        throw new HarnessValidationError(
          'channels.enqueueOutbox().target.platform',
          `must match channel binding platform "${binding.platform}"`,
        );
      }
      const plan = (await config.adapter.resolveDeliveryPlan?.(opts, {
        harnessName: this._harnessName,
        channelId: binding.channelId,
        providerId: binding.providerId,
        platform: binding.platform,
        provider,
        binding,
      })) ?? {
        operationKind: opts.operationKind,
        operationName: opts.operationName,
        deliverySemantics: this._resolveChannelDeliverySemantics(opts, config),
      };
      const now = Date.now();
      return storage.enqueueChannelOutbox({
        id: `outbox-${randomUUID()}`,
        harnessName: this._harnessName,
        channelId: binding.channelId,
        providerId: binding.providerId,
        bindingId: binding.bindingId,
        bindingGeneration: 1,
        idempotencyKey: opts.idempotencyKey,
        payloadHash: opts.payloadHash ?? sha256CanonicalJson(opts.payload),
        resourceId: opts.resourceId,
        threadId: opts.threadId,
        ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}),
        ...(opts.owningSessionId !== undefined ? { owningSessionId: opts.owningSessionId } : {}),
        ...(opts.source !== undefined ? { source: opts.source } : {}),
        target: opts.target,
        kind: opts.kind,
        operationKind: plan.operationKind,
        ...(plan.operationName !== undefined ? { operationName: plan.operationName } : {}),
        payload: opts.payload,
        deliverySemantics: plan.deliverySemantics,
        status: 'pending',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });
    },

    dispatchOutbox: async (opts: ChannelOutboxDispatchOptions = {}): Promise<ChannelOutboxDispatchResult> => {
      const storage = this._requireStorage('channels.dispatchOutbox()');
      const claimId = opts.claimId ?? `outbox-claim-${randomUUID()}`;
      const claimed = await storage.claimChannelOutbox({
        harnessName: this._harnessName,
        ...(opts.channelId !== undefined ? { channelId: opts.channelId } : {}),
        claimId,
        limit: opts.limit ?? this._channelOutboxBatchSize(opts.channelId),
        now: opts.now ?? Date.now(),
        claimTtlMs: opts.claimTtlMs ?? this._channelOutboxClaimTtlMs(opts.channelId),
      });
      const result: ChannelOutboxDispatchResult = { claimed: claimed.length, sent: 0, failed: 0, dead: 0, items: [] };
      const itemResults = await Promise.allSettled(
        claimed.map(item => this._dispatchClaimedChannelOutboxItem(storage, item, claimId, opts)),
      );
      for (const [index, settled] of itemResults.entries()) {
        const itemResult =
          settled.status === 'fulfilled'
            ? settled.value
            : ({
                outboxItemId: claimed[index]!.id,
                status: 'failed',
                error: {
                  code: 'unknown',
                  message: settled.reason instanceof Error ? settled.reason.message : 'channel outbox dispatch failed',
                },
              } satisfies ChannelOutboxDispatchResult['items'][number]);
        if (itemResult.status === 'sent') result.sent += 1;
        if (itemResult.status === 'failed') result.failed += 1;
        if (itemResult.status === 'dead') result.dead += 1;
        result.items.push(itemResult);
      }
      return result;
    },
  };

  private _requireChannelRuntime(channelId: string): { binding: HarnessChannelBinding; config: HarnessChannelConfig } {
    const binding = this.getChannelBinding(channelId);
    const config = this._channelRegistry.getConfig(channelId);
    if (!binding || !config) {
      throw new HarnessConfigError(`channels["${channelId}"]`, 'is not registered on this harness');
    }
    return { binding, config };
  }

  private _requireChannelProvider(binding: HarnessChannelBinding) {
    const provider = this.mastra.getChannelProvider(binding.providerId);
    if (!provider || provider.id !== binding.platform) {
      throw new HarnessConfigError(
        `channels["${binding.channelId}"].providerId`,
        `provider "${binding.providerId}" is unavailable or no longer matches platform "${binding.platform}"`,
      );
    }
    return provider;
  }

  private async _visibleChannelDiagnosticSessionIds(
    root: SessionRecord,
  ): Promise<{ sessionIds: string[]; truncated: boolean }> {
    const summaries = await this.listSessions({ resourceId: root.resourceId, includeClosed: true });
    const childrenByParent = new Map<string, SessionSummary[]>();
    for (const summary of summaries) {
      if (!summary.parentSessionId) continue;
      if (summary.resourceId !== root.resourceId) continue;
      const children = childrenByParent.get(summary.parentSessionId) ?? [];
      children.push(summary);
      childrenByParent.set(summary.parentSessionId, children);
    }

    const visible = new Set<string>([root.id]);
    let truncated = false;
    const stack: Array<{ id: string; depth: number }> = [{ id: root.id, depth: 0 }];
    while (stack.length > 0) {
      const { id: parentId, depth } = stack.pop()!;
      if (depth >= CHANNEL_DIAGNOSTICS_MAX_DESCENDANT_DEPTH) {
        if ((childrenByParent.get(parentId)?.length ?? 0) > 0) truncated = true;
        continue;
      }
      for (const child of childrenByParent.get(parentId) ?? []) {
        if (visible.has(child.id)) continue;
        if (visible.size >= CHANNEL_DIAGNOSTICS_MAX_VISIBLE_SESSIONS) {
          truncated = true;
          return { sessionIds: Array.from(visible), truncated };
        }
        visible.add(child.id);
        stack.push({ id: child.id, depth: depth + 1 });
      }
    }
    return { sessionIds: Array.from(visible), truncated };
  }

  private _resolveChannelDeliverySemantics(
    opts: ChannelOutboxEnqueueOptions,
    config: HarnessChannelConfig,
  ): NonNullable<ChannelOutboxEnqueueOptions['deliverySemantics']> {
    return (
      opts.deliverySemantics ??
      config.adapter.deliverySemanticsByOperation?.[opts.operationKind] ??
      config.adapter.deliverySemantics ??
      'at-least-once'
    );
  }

  private _channelOutboxClaimTtlMs(channelId: string | undefined): number {
    if (channelId === undefined) return DEFAULT_CHANNEL_OUTBOX_CLAIM_TTL_MS;
    return this._channelRegistry.getConfig(channelId)?.outbox?.claimTtlMs ?? DEFAULT_CHANNEL_OUTBOX_CLAIM_TTL_MS;
  }

  private _channelOutboxBatchSize(channelId: string | undefined): number {
    if (channelId === undefined) return DEFAULT_CHANNEL_OUTBOX_BATCH_SIZE;
    return this._channelRegistry.getConfig(channelId)?.outbox?.batchSize ?? DEFAULT_CHANNEL_OUTBOX_BATCH_SIZE;
  }

  private async _dispatchClaimedChannelOutboxItem(
    storage: HarnessStorage,
    item: ChannelOutboxItem,
    claimId: string,
    opts: ChannelOutboxDispatchOptions,
  ): Promise<ChannelOutboxDispatchResult['items'][number]> {
    const { binding, config } = this._channelRuntimeForDispatch(item);
    const maxAttempts = config?.outbox?.maxAttempts ?? DEFAULT_CHANNEL_OUTBOX_MAX_ATTEMPTS;
    const claimTtlMs = opts.claimTtlMs ?? config?.outbox?.claimTtlMs ?? DEFAULT_CHANNEL_OUTBOX_CLAIM_TTL_MS;
    const claimRenewMs = config?.outbox?.claimRenewMs ?? Math.max(1, Math.floor(claimTtlMs / 2));
    const markFailure = async (code: HarnessRowErrorCode, message: string, retryable = true) => {
      const dead = !retryable || item.attempts >= maxAttempts;
      const retryBaseNow = opts.now ?? Date.now();
      try {
        await storage.markChannelOutboxFailed({
          outboxItemId: item.id,
          claimId,
          dead,
          ...(!dead ? { retryAt: retryBaseNow + this._channelOutboxRetryBackoffMs(config, item.attempts) } : {}),
          error: { code, message, retryable: !dead },
        });
      } catch (err) {
        if (!(err instanceof HarnessStorageChannelOutboxClaimConflictError)) throw err;
        return {
          outboxItemId: item.id,
          status: 'failed' as const,
          error: { code, message: `${message}; claim was lost before failure could be recorded` },
        };
      }
      return {
        outboxItemId: item.id,
        status: dead ? ('dead' as const) : ('failed' as const),
        error: { code, message },
      };
    };

    if (!binding || !config || binding.providerId !== item.providerId || item.bindingGeneration !== 1) {
      return markFailure('delivery_operation_unavailable', 'channel binding is unavailable for outbox delivery');
    }

    const provider = this.mastra.getChannelProvider(binding.providerId);
    if (!provider || provider.id !== binding.platform) {
      return markFailure('delivery_operation_unavailable', 'channel provider is unavailable for outbox delivery');
    }

    const ctx = {
      harnessName: this._harnessName,
      channelId: binding.channelId,
      providerId: binding.providerId,
      platform: binding.platform,
      provider,
      binding,
    };

    let providerMessageId: string | undefined;
    let providerReceipt: ChannelProviderDeliveryReceipt | undefined;
    let deliveryConfirmed = false;
    try {
      await storage.renewChannelOutboxClaim({
        outboxItemId: item.id,
        claimId,
        now: Date.now(),
        claimTtlMs,
      });

      if (item.deliverySemantics === 'lookup-reconcile' && item.attempts > 1) {
        if (!config.adapter.reconcileDelivery) {
          return markFailure(
            'delivery_operation_unavailable',
            'channel adapter cannot reconcile lookup-reconcile outbox delivery',
          );
        }
        const reconciliation = await this._withChannelOutboxClaimHeartbeat(
          storage,
          item,
          claimId,
          claimTtlMs,
          claimRenewMs,
          () => config.adapter.reconcileDelivery!(item, ctx),
        );
        if (reconciliation.delivered) {
          providerMessageId = reconciliation.providerMessageId ?? reconciliation.providerReceipt?.providerMessageId;
          providerReceipt = reconciliation.providerReceipt;
          deliveryConfirmed = true;
        }
      }

      if (!deliveryConfirmed) {
        const delivery = await this._withChannelOutboxClaimHeartbeat(
          storage,
          item,
          claimId,
          claimTtlMs,
          claimRenewMs,
          () => config.adapter.deliver(item, ctx),
        );
        providerMessageId = delivery.providerMessageId ?? delivery.providerReceipt?.providerMessageId;
        providerReceipt = delivery.providerReceipt;
        deliveryConfirmed = true;
      }
    } catch (err) {
      return markFailure('unknown', err instanceof Error ? err.message : 'channel outbox delivery failed');
    }
    try {
      await storage.markChannelOutboxSent({
        outboxItemId: item.id,
        claimId,
        ...(providerMessageId !== undefined ? { providerMessageId } : {}),
        ...(providerReceipt !== undefined ? { providerReceipt } : {}),
      });
    } catch (err) {
      if (!(err instanceof HarnessStorageChannelOutboxClaimConflictError)) throw err;
      return {
        outboxItemId: item.id,
        status: 'failed',
        error: { code: 'unknown', message: 'channel outbox claim was lost before sent delivery could be recorded' },
      };
    }
    return {
      outboxItemId: item.id,
      status: 'sent',
      ...(providerMessageId !== undefined ? { providerMessageId } : {}),
    };
  }

  private _channelRuntimeForDispatch(item: ChannelOutboxItem): {
    binding?: HarnessChannelBinding;
    config?: HarnessChannelConfig;
  } {
    const binding = this.getChannelBinding(item.channelId);
    const config = this._channelRegistry.getConfig(item.channelId);
    if (!binding || !config) return {};
    if (binding.bindingId !== item.bindingId) return {};
    return { binding, config };
  }

  private _channelOutboxRetryBackoffMs(config: HarnessChannelConfig | undefined, attempt: number): number {
    return config?.outbox?.retryBackoffMs?.(attempt) ?? Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
  }

  private async _withChannelOutboxClaimHeartbeat<T>(
    storage: HarnessStorage,
    item: ChannelOutboxItem,
    claimId: string,
    claimTtlMs: number,
    claimRenewMs: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    let heartbeatError: unknown;
    let interval: ReturnType<typeof setInterval> | undefined;
    const renew = async () => {
      try {
        await storage.renewChannelOutboxClaim({
          outboxItemId: item.id,
          claimId,
          now: Date.now(),
          claimTtlMs,
        });
        heartbeatError = undefined;
      } catch (err) {
        heartbeatError = err;
        if (interval !== undefined) clearInterval(interval);
      }
    };
    interval = setInterval(() => {
      void renew();
    }, claimRenewMs);
    interval.unref?.();
    try {
      const result = await operation();
      if (heartbeatError) throw heartbeatError;
      return result;
    } finally {
      if (interval !== undefined) clearInterval(interval);
    }
  }

  // -------------------------------------------------------------------------
  // Permission gate accessors — §4.2e.
  // -------------------------------------------------------------------------

  /**
   * Resolve a tool name to its category, using the resolver configured on
   * `HarnessConfig.toolCategoryResolver`. Returns `null` for tools with no
   * configured resolver or that the resolver explicitly leaves
   * uncategorised. Used by the permission gate and by TUIs that want to
   * render tools grouped by category.
   */
  getToolCategory(opts: { toolName: string }): ToolCategory | null {
    if (!this._toolCategoryResolver) return null;
    return this._toolCategoryResolver(opts.toolName) ?? null;
  }

  /** @internal — Session reads this as the floor when no per-tool / per-category rule applies. */
  _getDefaultPermissionPolicy(): PermissionPolicy {
    return this._defaultPermissionPolicy;
  }

  // -------------------------------------------------------------------------
  // Session resolver — §4.1, §5.3.
  // -------------------------------------------------------------------------

  async session(opts: SessionResolveOptions): Promise<Session> {
    if (this._shutdown) {
      throw new Error('Harness is shut down');
    }
    const storage = this._requireStorage('session()');

    // 1) sessionId-only lookups.
    if ('sessionId' in opts && opts.sessionId && !('threadId' in opts && opts.threadId)) {
      return this._withSessionResolveSingleFlight(
        this._sessionResolveSingleFlightKey('session', opts.sessionId, opts.resourceId ?? ''),
        () => this._resolveById(storage, opts.sessionId!, opts.resourceId),
      );
    }

    // 2) threadId resolution. May be `{ fresh: true }` to force a new thread.
    if ('threadId' in opts && opts.threadId !== undefined) {
      const key =
        typeof opts.threadId === 'string'
          ? this._sessionResolveSingleFlightKey('thread', opts.resourceId ?? '', opts.threadId)
          : opts.sessionId
            ? this._sessionResolveSingleFlightKey('session', opts.sessionId, opts.resourceId ?? '')
            : undefined;
      return key
        ? this._withSessionResolveSingleFlight(key, () => this._resolveByThread(storage, opts))
        : this._resolveByThread(storage, opts);
    }

    // 3) resourceId-only resolution: most-recent active or create.
    if ('resourceId' in opts && opts.resourceId) {
      return this._withSessionResolveSingleFlight(
        this._sessionResolveSingleFlightKey('resource', opts.resourceId),
        () => this._resolveByResource(storage, opts),
      );
    }

    throw new HarnessConfigError('session()', 'invalid resolver options');
  }

  private _sessionResolveSingleFlightKey(kind: 'session' | 'thread' | 'resource', ...parts: string[]): string {
    return JSON.stringify([this._harnessName, kind, ...parts]);
  }

  private _withSessionResolveSingleFlight(key: string, resolve: () => Promise<Session>): Promise<Session> {
    const existing = this._sessionResolvePromises.get(key);
    if (existing) return existing;
    const promise = resolve().finally(() => {
      if (this._sessionResolvePromises.get(key) === promise) {
        this._sessionResolvePromises.delete(key);
      }
    });
    this._sessionResolvePromises.set(key, promise);
    return promise;
  }

  private async _resolveById(storage: HarnessStorage, sessionId: string, resourceId?: string): Promise<Session> {
    // In-memory hit — return live instance, enforce resourceId scoping.
    const live = this._liveSessions.get(sessionId);
    if (live) {
      if (resourceId !== undefined && live.resourceId !== resourceId) {
        // Don't leak existence across tenants.
        throw new HarnessSessionNotFoundError(sessionId);
      }
      if (live.isClosing) {
        throw new HarnessSessionClosingError(sessionId);
      }
      return live;
    }

    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId });
    if (!stored) throw new HarnessSessionNotFoundError(sessionId);
    if (resourceId !== undefined && stored.resourceId !== resourceId) {
      // Cross-tenant existence is never leaked.
      throw new HarnessSessionNotFoundError(sessionId);
    }
    if (stored.closedAt !== undefined) {
      throw new HarnessSessionClosedError(sessionId);
    }
    if (stored.closingAt !== undefined) {
      throw new HarnessSessionClosingError(sessionId);
    }

    await this._markExternalSessionStorageOwner(stored.threadId, { requireExisting: false });
    return this._hydrate(storage, stored);
  }

  private async _resolveByThread(
    storage: HarnessStorage,
    opts: Extract<SessionResolveOptions, { threadId: any }>,
  ): Promise<Session> {
    const wantsFreshThread = typeof opts.threadId !== 'string';
    const resourceId = opts.resourceId!;

    if (wantsFreshThread) {
      // Force a brand-new thread + session. ownsThread = true so the cascade
      // can later tear the thread down with the session.
      return this._createFresh(storage, {
        resourceId,
        threadId: this._mintThreadId(),
        ownsThread: true,
        sessionId: opts.sessionId,
        parentSessionId: opts.parentSessionId,
        origin: opts.origin ?? 'top-level',
        modeId: opts.modeId,
        modelId: opts.modelId,
        subagentDepth: opts.subagentDepth,
      });
    }

    const threadId = opts.threadId as string;

    // In-memory hit by (threadId, resourceId)?
    for (const live of this._liveSessions.values()) {
      if (live.threadId === threadId && live.resourceId === resourceId) {
        if (live.isClosing) {
          throw new HarnessSessionClosingError(live.id);
        }
        return live;
      }
    }

    // Storage lookup — adapters filter out closed records.
    const stored = await storage.loadSessionByThread({ harnessName: this._harnessName, threadId, resourceId });
    if (stored) {
      if (stored.closingAt !== undefined) {
        throw new HarnessSessionClosingError(stored.id);
      }
      await this._markExternalSessionStorageOwner(stored.threadId, { requireExisting: false });
      return this._hydrate(storage, stored);
    }

    await this._assertNoPreboundDefaultNamespaceShadow(storage, threadId, resourceId);

    // No active record — create a fresh session bound to this thread.
    return this._createFresh(storage, {
      resourceId,
      threadId,
      ownsThread: false,
      sessionId: opts.sessionId,
      parentSessionId: opts.parentSessionId,
      origin: opts.origin ?? 'top-level',
      modeId: opts.modeId,
      modelId: opts.modelId,
      subagentDepth: opts.subagentDepth,
    });
  }

  private async _resolveByResource(
    storage: HarnessStorage,
    opts: Extract<SessionResolveOptions, { resourceId: string }>,
  ): Promise<Session> {
    const resourceId = opts.resourceId!;

    // Most-recent live session for that resource wins, when present.
    let liveCandidate: Session | undefined;
    for (const live of this._liveSessions.values()) {
      if (live.resourceId !== resourceId) continue;
      if (live.isClosing) continue;
      if (!liveCandidate || live.lastActivityAt > liveCandidate.lastActivityAt) {
        liveCandidate = live;
      }
    }
    if (liveCandidate) return liveCandidate;

    const summaries = await storage.listSessions({ harnessName: this._harnessName, resourceId, includeClosed: false });
    // listSessions returns newest-first by lastActivityAt. Closing records
    // still occupy their active thread key, but resource-only resolution can
    // skip them and create/hydrate another active session for the resource.
    for (const head of summaries) {
      const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: head.id });
      if (stored && stored.closedAt === undefined && stored.closingAt === undefined) {
        await this._markExternalSessionStorageOwner(stored.threadId, { requireExisting: false });
        return this._hydrate(storage, stored);
      }
    }

    // Nothing active → fresh thread + session.
    return this._createFresh(storage, {
      resourceId,
      threadId: this._mintThreadId(),
      ownsThread: true,
      origin: opts.origin ?? 'top-level',
      modeId: opts.modeId,
      modelId: opts.modelId,
      parentSessionId: opts.parentSessionId,
      subagentDepth: opts.subagentDepth,
    });
  }

  // -------------------------------------------------------------------------
  // Session creation / hydration.
  // -------------------------------------------------------------------------

  private async _createFresh(
    storage: HarnessStorage,
    init: {
      resourceId: string;
      threadId: string;
      ownsThread: boolean;
      sessionId?: string;
      parentSessionId?: string;
      origin: 'top-level' | 'subagent-tool';
      modeId?: string;
      modelId?: string;
      subagentDepth?: number;
    },
  ): Promise<Session> {
    const sessionId = init.sessionId ?? `sess-${randomUUID()}`;
    const now = Date.now();

    const modeId = init.modeId ?? this._defaultModeId;
    if (modeId === undefined) {
      throw new HarnessConfigError(
        'session()',
        'cannot create a session without a modeId — config has no modes and no override was supplied',
      );
    }
    const mode = this._modesById.get(modeId);
    if (!mode) {
      throw new HarnessConfigError('session().modeId', `unknown mode "${modeId}"`);
    }
    const record: SessionRecord = {
      id: sessionId,
      harnessName: this._harnessName,
      resourceId: init.resourceId,
      threadId: init.threadId,
      parentSessionId: init.parentSessionId,
      origin: init.origin,
      ownsThread: init.ownsThread,
      subagentDepth: init.subagentDepth ?? 0,
      modeId,
      modelId: init.modelId ?? '',
      subagentModelOverrides: {},
      permissionRules: emptyPermissionRules(),
      sessionGrants: emptySessionGrants(),
      tokenUsage: zeroTokenUsage(),
      pendingQueue: [],
      state: {},
      createdAt: now,
      lastActivityAt: now,
      version: 0,
      ownerId: this.ownerId,
      leaseExpiresAt: now + this._leaseTtlMs,
    };

    const liveParentError = this._getLiveParentAdmissionError(init.parentSessionId, init.resourceId);
    if (liveParentError) {
      const existing = await storage.loadSessionByThread({
        harnessName: this._harnessName,
        threadId: init.threadId,
        resourceId: init.resourceId,
      });
      if (existing) {
        if (existing.closingAt !== undefined) {
          throw new HarnessSessionClosingError(existing.id);
        }
        return this._hydrate(storage, existing);
      }
      throw liveParentError;
    }

    await this._markExternalSessionStorageOwner(init.threadId, { requireExisting: !init.ownsThread });

    let admitted;
    try {
      admitted = await storage.createOrLoadActiveSession(record, {
        initialLease: { ownerId: this.ownerId, ttlMs: this._leaseTtlMs },
      });
    } catch (err) {
      if (err instanceof HarnessStorageParentSessionUnavailableError) {
        if (err.reason === 'closing') throw new HarnessSessionClosingError(err.parentSessionId);
        if (err.reason === 'closed') throw new HarnessSessionClosedError(err.parentSessionId);
        throw new HarnessSessionNotFoundError(err.parentSessionId);
      }
      // A version conflict on first insert means another writer beat us to
      // this id (only realistic for deterministic ids passed by the caller).
      if (err instanceof HarnessStorageVersionConflictError) {
        throw new HarnessSessionLockedError(sessionId, 'unknown', 0);
      }
      throw new HarnessStorageError(sessionId, 'flush', err);
    }

    if (!admitted.created) {
      if (admitted.record.closingAt !== undefined) {
        throw new HarnessSessionClosingError(admitted.record.id);
      }
      return this._hydrate(storage, admitted.record);
    }

    return this._publish(storage, admitted.record);
  }

  private _getLiveParentAdmissionError(parentSessionId: string | undefined, resourceId: string): Error | undefined {
    if (!parentSessionId) return undefined;
    const liveParent = this._liveSessions.get(parentSessionId);
    if (!liveParent) return undefined;
    if (liveParent.resourceId !== resourceId) return new HarnessSessionNotFoundError(parentSessionId);
    if (liveParent.isClosing) return new HarnessSessionClosingError(parentSessionId);
    if (liveParent.isClosed) return new HarnessSessionClosedError(parentSessionId);
    return undefined;
  }

  private async _assertNoPreboundDefaultNamespaceShadow(
    storage: HarnessStorage,
    threadId: string,
    resourceId: string,
  ): Promise<void> {
    if (!this._guardPreboundDefaultNamespace || this._harnessName === 'default') return;
    const existingDefault = await storage.loadSessionByThread({
      harnessName: 'default',
      threadId,
      resourceId,
    });
    if (!existingDefault) return;
    throw new HarnessConfigError(
      'session().threadId',
      'cannot create a registered harness session for a thread/resource with an active default-namespace session; close or migrate the default session first',
    );
  }

  private async _hydrate(storage: HarnessStorage, stored: SessionRecord): Promise<Session> {
    const lease = await this._acquireLease(storage, stored.harnessName, stored.id);
    const record: SessionRecord = {
      ...stored,
      ownerId: this.ownerId,
      leaseExpiresAt: lease.expiresAt,
      version: lease.version,
    };
    return this._publish(storage, record, await this._eventReplaySeedFor(storage, record));
  }

  private _publish(
    storage: HarnessStorage,
    record: SessionRecord,
    eventReplaySeed?: { epoch: string; nextSequence: number },
  ): Session {
    return this._adoptSession(storage, record, { emitCreated: true, kickQueueDrain: true, eventReplaySeed });
  }

  private _adoptSession(
    storage: HarnessStorage,
    record: SessionRecord,
    opts: {
      emitCreated: boolean;
      kickQueueDrain: boolean;
      eventReplaySeed?: { epoch: string; nextSequence: number };
    },
  ): Session {
    const live = this._liveSessions.get(record.id);
    if (live) {
      if (live.isClosing) {
        throw new HarnessSessionClosingError(record.id);
      }
      if (live.isClosed) {
        throw new HarnessSessionClosedError(record.id);
      }
      return live;
    }

    // Workspace provider validation (§2.7). If the stored record carries a
    // workspace state blob, the configured provider must match. Mismatch is
    // a hard error — refuse to hand the record to the wrong implementation.
    // Non-resumable providers can never restore from stored state; flag the
    // session as "lost" so the first getWorkspace() call surfaces the error.
    let workspaceLost = false;
    if (record.workspace?.providerId && this._workspaceKind === 'per-session') {
      const configured = this._workspaceRegistry.providerId;
      if (configured && configured !== record.workspace.providerId) {
        throw new HarnessWorkspaceProviderMismatchError(record.id, configured, record.workspace.providerId);
      }
      if (!this._workspaceRegistry.resumable) {
        // Provider can't resume — first getWorkspace() throws HarnessWorkspaceLostError.
        workspaceLost = true;
      }
    }

    const session = new Session({
      harness: this,
      storage,
      ownerId: this.ownerId,
      record,
      leaseExpiresAt: record.leaseExpiresAt ?? Date.now() + this._leaseTtlMs,
      eventReplaySeed: opts.eventReplaySeed,
    });
    if (workspaceLost) session._markWorkspaceLost();
    this._hasAdoptedSessions = true;
    this._liveSessions.set(record.id, session);

    // Bridge the session's events onto the harness-level emitter so a single
    // harness.subscribe() sees every session's turn activity. Forwarded
    // events keep their original id/timestamp/sessionId.
    const bridge = session._subscribeInternal(event => this._emitter.forward(event));
    this._sessionEventBridges.set(record.id, bridge);
    this._ensureLeaseRenewalLoop();

    if (opts.emitCreated) {
      // Surface session creation to harness-level subscribers AFTER the bridge
      // is wired. Stamps `sessionId` via the override so harness emitter
      // (no scope) can carry it.
      this._emitter.emit(
        {
          type: 'session_created',
          resourceId: record.resourceId,
          threadId: record.threadId,
          ...(record.parentSessionId !== undefined && { parentSessionId: record.parentSessionId }),
          modeId: record.modeId,
          modelId: record.modelId,
        },
        { sessionId: record.id },
      );
    }

    // If the hydrated record has queued items waiting and no live suspension
    // blocking them, kick the drain. A `pendingResume` with `resumedAt` is
    // also kicked so stale queued-resume recovery can clear/fail it instead
    // of leaving the queue permanently busy. Items recovered this way emit
    // `queue_item_replayed` instead of `queue_item_started` because the
    // original `queue()` caller's resolver is gone.
    if (
      opts.kickQueueDrain &&
      (record.pendingQueue?.length ?? 0) > 0 &&
      (record.pendingResume === undefined || record.pendingResume.resumedAt !== undefined)
    ) {
      void session._kickQueueDrain();
    }

    return session;
  }

  private _ensureLeaseRenewalLoop(): void {
    if (this._shutdown) return;
    if (this._leaseRenewalTimer !== undefined) return;
    const intervalMs = Math.max(1_000, Math.floor(this._leaseTtlMs / 3));
    this._leaseRenewalTimer = setInterval(() => {
      void this._renewLiveSessionLeases();
    }, intervalMs);
    this._leaseRenewalTimer.unref?.();
  }

  private _stopLeaseRenewalLoop(): void {
    if (this._leaseRenewalTimer === undefined) return;
    clearInterval(this._leaseRenewalTimer);
    this._leaseRenewalTimer = undefined;
  }

  private _stopLeaseRenewalLoopIfIdle(): void {
    if (this._liveSessions.size > 0) return;
    this._stopLeaseRenewalLoop();
  }

  private async _renewLiveSessionLeases(): Promise<void> {
    if (this._leaseRenewing) return;
    if (this._shutdown || this._liveSessions.size === 0) {
      this._stopLeaseRenewalLoopIfIdle();
      return;
    }
    this._leaseRenewing = true;
    const storage = this._requireStorage('session lease renewal');
    const sessions = Array.from(this._liveSessions.values());
    try {
      await Promise.all(
        sessions.map(async session => {
          if (session.lifecycleState !== 'live' && session.lifecycleState !== 'closing') return;
          try {
            // Route this session's renewal through its own lease-write chain
            // so a concurrent `Session.extendLease(...)` cannot race with the
            // heartbeat against `storage.renewSessionLease`. Compute the
            // effective TTL inside the chained step so it reflects the
            // latest extension deadline (a default-TTL heartbeat could
            // otherwise overwrite a longer extension that landed between
            // queueing and execution).
            await session._enqueueLeaseRenewal(async () => {
              const record = session.getRecord();
              // Skip renewal for cancelled sessions — the durable
              // `cancelRequest` marker takes precedence over lease
              // extension. Letting the lease expire releases the
              // session back to the storage layer for cleanup.
              if (record.cancelRequest !== undefined) return;
              const effectiveTtl = session._getEffectiveLeaseTtlMs(this._leaseTtlMs);
              const lease = await storage.renewSessionLease({
                harnessName: record.harnessName,
                sessionId: session.id,
                ownerId: this.ownerId,
                ttlMs: effectiveTtl,
              });
              session._markLeaseRenewed(lease.expiresAt);
            });
          } catch (err) {
            if (err instanceof HarnessStorageLeaseConflictError || err instanceof HarnessStorageSessionNotFoundError) {
              await this._evictLiveSession(session, 'lease_lost');
              return;
            }
            console.error('[harness/v1] session lease renewal failed:', err);
          }
        }),
      );
    } finally {
      this._leaseRenewing = false;
      this._stopLeaseRenewalLoopIfIdle();
    }
  }

  private async _evictLiveSession(session: Session, reason: 'lease_lost' | 'shutdown'): Promise<void> {
    if (this._liveSessions.get(session.id) !== session) return;
    session._emit({ type: 'session_evicted', reason });
    try {
      await session._flushEventPersistence();
    } catch {
      // Best-effort: lease loss may also mean event persistence is no longer available.
    }
    session._markEvicted(session.getRecord() as SessionRecord);
    const bridge = this._sessionEventBridges.get(session.id);
    if (bridge) {
      bridge();
      this._sessionEventBridges.delete(session.id);
    }
    this._liveSessions.delete(session.id);
    this._stopLeaseRenewalLoopIfIdle();

    try {
      if (this._workspaceKind === 'per-session') {
        await this._workspaceRegistry.releasePerSession({ sessionId: session.id });
      } else if (this._workspaceKind === 'per-resource') {
        await this._workspaceRegistry.releasePerResource({ resourceId: session.resourceId });
      }
    } catch {
      // Best-effort — registry surfaces errors via workspace_error event.
    }
  }

  private async _eventReplaySeedFor(
    storage: HarnessStorage,
    record: SessionRecord,
  ): Promise<{ epoch: string; nextSequence: number } | undefined> {
    try {
      const state = await storage.getSessionEventReplayState({
        harnessName: record.harnessName,
        sessionId: record.id,
        resourceId: record.resourceId,
        threadId: record.threadId,
      });
      if (!state) return undefined;
      return { epoch: state.epoch, nextSequence: state.newestSequence + 1 };
    } catch (err) {
      if (err instanceof HarnessStorageSessionEventReplayUnsupportedError) return undefined;
      throw new HarnessStorageError(record.id, 'load', err);
    }
  }

  private async _acquireLease(storage: HarnessStorage, harnessName: string, sessionId: string) {
    try {
      return await storage.acquireSessionLease({
        harnessName,
        sessionId,
        ownerId: this.ownerId,
        ttlMs: this._leaseTtlMs,
      });
    } catch (err) {
      if (err instanceof HarnessStorageLeaseConflictError) {
        throw new HarnessSessionLockedError(sessionId, err.heldBy, err.expiresAt);
      }
      if (err instanceof HarnessStorageSessionNotFoundError) {
        throw new HarnessSessionNotFoundError(sessionId);
      }
      throw new HarnessStorageError(sessionId, 'load', err);
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle.
  // -------------------------------------------------------------------------

  /**
   * Soft-close: persist closingAt, reject new work, drain admitted turns until
   * each close deadline, terminalize descendants bottom-up, set closedAt,
   * release leases, and drop live instances. Idempotent. See §5.5.
   */
  async closeSession(opts: { sessionId: string; resourceId?: string }): Promise<void> {
    if (this._shutdown) return;
    const storage = this._requireStorage('closeSession()');
    const live = this._liveSessions.get(opts.sessionId);
    if (live) {
      if (opts.resourceId !== undefined && live.resourceId !== opts.resourceId) {
        throw new HarnessSessionNotFoundError(opts.sessionId);
      }
      await this._closeSession(live);
      return;
    }
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored) throw new HarnessSessionNotFoundError(opts.sessionId);
    if (opts.resourceId !== undefined && stored.resourceId !== opts.resourceId) {
      throw new HarnessSessionNotFoundError(opts.sessionId);
    }
    if (stored.closedAt !== undefined) return; // already closed → idempotent.
    await this._closeSessionRecord(storage, stored, undefined, { resourceId: opts.resourceId });
  }

  /**
   * Hard-delete a session subtree. Non-force delete is a closed-record cleanup
   * path; force delete first reuses the close cascade so pending local work is
   * terminalized before storage rows and owned attachments are removed.
   */
  async deleteSession(opts: SessionDeleteOptions): Promise<void> {
    if (this._shutdown) return;
    const storage = this._requireStorage('deleteSession()');
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored) throw new HarnessSessionNotFoundError(opts.sessionId);
    if (stored.resourceId !== opts.resourceId) {
      throw new HarnessSessionNotFoundError(opts.sessionId);
    }

    if (opts.force) {
      await this._forceDeleteSessionRecord(storage, stored, () => !this._shutdown, { resourceId: opts.resourceId });
      return;
    }

    const tree = await this._collectDeleteTree(storage, stored);
    const blockers = this._collectDeleteBlockers(tree);
    if (blockers.length > 0) {
      throw new HarnessSessionDeleteBlockedError(stored.id, blockers);
    }
    if (this._shutdown) return;
    await this._deleteClosedTree(storage, tree);
  }

  /**
   * @internal — used by `Session.close()` and `Harness.closeSession()`.
   */
  async _closeSession(session: Session): Promise<void> {
    if (this._shutdown) return;
    if (session.isClosed) return;

    const storage = this._requireStorage('closeSession()');
    await this._closeSessionRecord(storage, session.getRecord());
  }

  private async _closeSessionRecord(
    storage: HarnessStorage,
    rootRecord: SessionRecord,
    closedLiveSessions?: Map<string, Session>,
    scope: { resourceId?: string } = {},
  ): Promise<void> {
    const existing = this._closePromises.get(rootRecord.id);
    if (existing) return existing;

    const closeIds = new Set<string>([rootRecord.id]);
    const persistedCloseIds = new Set<string>();
    this._liveSessions.get(rootRecord.id)?._beginClosing();
    let closePromise!: Promise<void>;
    closePromise = Promise.resolve()
      .then(() =>
        this._closeSessionRecordOnce(
          storage,
          rootRecord,
          closeIds,
          persistedCloseIds,
          closePromise,
          closedLiveSessions,
          scope,
        ),
      )
      .catch(err => {
        for (const id of closeIds) {
          if (!persistedCloseIds.has(id)) {
            this._liveSessions.get(id)?._restoreLiveAfterFailedClose();
          }
        }
        throw err;
      })
      .finally(() => {
        for (const id of closeIds) {
          if (this._closePromises.get(id) === closePromise) {
            this._closePromises.delete(id);
          }
        }
      });
    this._closePromises.set(rootRecord.id, closePromise);
    return closePromise;
  }

  private async _closeSessionRecordOnce(
    storage: HarnessStorage,
    rootRecord: SessionRecord,
    closeIds: Set<string>,
    persistedCloseIds: Set<string>,
    closePromise: Promise<void>,
    closedLiveSessions?: Map<string, Session>,
    scope: { resourceId?: string } = {},
  ): Promise<void> {
    const tree: CloseTreeNode[] = [];
    try {
      const root = await this._prepareCloseNode(storage, rootRecord, 0, scope);
      if (root.record.closedAt !== undefined) {
        await this._releaseCloseTreeLeases(storage, [root]);
        return;
      }
      tree.push(root);
      tree[0] = await this._markCloseNodeClosing(storage, root, persistedCloseIds);

      for (let index = 0; index < tree.length; index++) {
        const node = tree[index]!;
        const children = await storage.listSessions({
          harnessName: node.record.harnessName,
          resourceId: root.record.resourceId,
          includeClosed: false,
          parentSessionId: node.record.id,
        });
        for (const child of children) {
          const stored = await storage.loadSession({ harnessName: node.record.harnessName, sessionId: child.id });
          if (!stored || stored.closedAt !== undefined) continue;
          const existingClose = this._closePromises.get(stored.id);
          if (existingClose && existingClose !== closePromise) {
            await existingClose;
            continue;
          }
          closeIds.add(stored.id);
          this._closePromises.set(stored.id, closePromise);
          const childNode = await this._prepareCloseNode(storage, stored, node.depth + 1, {
            resourceId: root.record.resourceId,
          });
          if (childNode.record.closedAt !== undefined) {
            closeIds.delete(stored.id);
            if (this._closePromises.get(stored.id) === closePromise) {
              this._closePromises.delete(stored.id);
            }
            await this._releaseCloseTreeLeases(storage, [childNode]);
            continue;
          }
          childNode.live?._beginClosing();
          tree.push(childNode);
          tree[tree.length - 1] = await this._markCloseNodeClosing(storage, childNode, persistedCloseIds);
        }
      }

      await this._drainCloseTree(tree);
      await this._terminalizeCloseTree(storage, tree, closedLiveSessions);
    } catch (err) {
      await this._releaseCloseTreeLeases(storage, tree);
      throw err;
    }
  }

  private async _prepareCloseNode(
    storage: HarnessStorage,
    record: SessionRecord,
    depth: number,
    scope: { resourceId?: string } = {},
  ): Promise<CloseTreeNode> {
    const live = this._liveSessions.get(record.id);
    if (live) {
      if (scope.resourceId !== undefined && live.resourceId !== scope.resourceId) {
        throw new HarnessSessionNotFoundError(record.id);
      }
      return {
        record: live.getRecord(),
        depth,
        live,
        leaseAcquired: false,
      };
    }

    const lease = await this._acquireLease(storage, record.harnessName, record.id);
    let latest: SessionRecord | null;
    try {
      latest = await storage.loadSession({ harnessName: record.harnessName, sessionId: record.id });
      if (!latest) throw new HarnessSessionNotFoundError(record.id);
      if (scope.resourceId !== undefined && latest.resourceId !== scope.resourceId) {
        throw new HarnessSessionNotFoundError(record.id);
      }
    } catch (err) {
      try {
        await storage.releaseSessionLease({
          harnessName: record.harnessName,
          sessionId: record.id,
          ownerId: this.ownerId,
        });
      } catch {
        // Preserve the original close failure. The lease release is best-effort
        // because the row may have disappeared or another owner may have won.
      }
      throw err;
    }
    const leasedRecord = {
      ...latest,
      ownerId: this.ownerId,
      leaseExpiresAt: lease.expiresAt,
      version: lease.version,
    };
    if ((leasedRecord.pendingQueue?.length ?? 0) > 0) {
      const recovered = this._adoptSession(storage, leasedRecord, {
        emitCreated: false,
        kickQueueDrain: false,
        eventReplaySeed: await this._eventReplaySeedFor(storage, leasedRecord),
      });
      return {
        record: recovered.getRecord(),
        depth,
        live: recovered,
        leaseAcquired: true,
      };
    }
    return {
      record: leasedRecord,
      depth,
      leaseAcquired: true,
    };
  }

  private async _markCloseNodeClosing(
    storage: HarnessStorage,
    node: CloseTreeNode,
    persistedCloseIds: Set<string>,
  ): Promise<CloseTreeNode> {
    const closingAt = node.record.closingAt ?? Date.now();
    const closeDeadlineAt = node.record.closeDeadlineAt ?? closingAt + this._closeTimeoutMs;
    if (node.live) {
      let record: SessionRecord;
      try {
        record = await node.live._flushClosingMarker({ closeTimeoutMs: this._closeTimeoutMs });
      } catch (err) {
        throw new HarnessStorageError(node.record.id, 'flush', err);
      }
      persistedCloseIds.add(record.id);
      this._emitSessionClosing(node.live, record);
      return { ...node, record };
    }

    const next: SessionRecord = {
      ...node.record,
      closingAt,
      closeDeadlineAt,
      lastActivityAt: Date.now(),
    };
    try {
      const saved = await storage.saveSession(next, {
        harnessName: next.harnessName,
        ownerId: this.ownerId,
        ifVersion: node.record.version,
      });
      next.version = saved.version;
    } catch (err) {
      throw new HarnessStorageError(next.id, 'flush', err);
    }

    persistedCloseIds.add(next.id);
    this._emitSessionClosing(undefined, next);
    return { ...node, record: next };
  }

  private async _drainCloseTree(tree: CloseTreeNode[]): Promise<void> {
    await Promise.all(
      tree.map(node => {
        if (!node.live) return undefined;
        return node.live._waitForCloseDrain(node.record.closeDeadlineAt ?? Date.now());
      }),
    );
  }

  private async _terminalizeCloseTree(
    storage: HarnessStorage,
    tree: CloseTreeNode[],
    closedLiveSessions?: Map<string, Session>,
  ): Promise<void> {
    const bottomUp = [...tree].sort((a, b) => b.depth - a.depth);
    for (const node of bottomUp) {
      if (node.record.closedAt !== undefined) {
        await this._releaseClosedSessionResources(storage, node.record, node.live, closedLiveSessions);
        continue;
      }
      const closedAt = Date.now();
      let closed: SessionRecord;
      if (node.live) {
        try {
          closed = await node.live._flushClosedMarker(closedAt);
        } catch (err) {
          throw new HarnessStorageError(node.record.id, 'flush', err);
        }
      } else {
        closed = {
          ...node.record,
          lastActivityAt: closedAt,
          closedAt,
        };
        try {
          const saved = await storage.saveSession(closed, {
            harnessName: closed.harnessName,
            ownerId: this.ownerId,
            ifVersion: node.record.version,
          });
          closed.version = saved.version;
        } catch (err) {
          throw new HarnessStorageError(closed.id, 'flush', err);
        }
      }
      await this._releaseClosedSessionResources(storage, closed, node.live, closedLiveSessions);
    }
  }

  private async _releaseCloseTreeLeases(storage: HarnessStorage, tree: CloseTreeNode[]): Promise<void> {
    for (const node of tree) {
      if (!node.leaseAcquired) continue;
      try {
        await storage.releaseSessionLease({
          harnessName: node.record.harnessName,
          sessionId: node.record.id,
          ownerId: this.ownerId,
        });
      } catch {
        // Best effort; the lease still expires by TTL.
      }
      if (node.live && this._liveSessions.get(node.record.id) === node.live) {
        node.live._markEvicted(node.record);
        const bridge = this._sessionEventBridges.get(node.record.id);
        if (bridge) {
          bridge();
          this._sessionEventBridges.delete(node.record.id);
        }
        this._liveSessions.delete(node.record.id);
      }
    }
    this._stopLeaseRenewalLoopIfIdle();
  }

  private _emitSessionClosing(session: Session | undefined, record: SessionRecord): void {
    const event = {
      type: 'session_closing' as const,
      reason: 'requested' as const,
      closingAt: record.closingAt!,
      closeDeadlineAt: record.closeDeadlineAt!,
    };
    if (session) {
      session._emit(event);
      return;
    }
    this._emitter.emit(event, { sessionId: record.id });
  }

  private async _releaseClosedSessionResources(
    storage: HarnessStorage,
    record: SessionRecord,
    session: Session | undefined,
    closedLiveSessions?: Map<string, Session>,
  ): Promise<void> {
    let eventPersistenceError: unknown;
    if (session) {
      closedLiveSessions?.set(record.id, session);
      session._markClosed(record);
      // Emit session_closed BEFORE we tear down the per-session bridge so
      // harness-level subscribers see the lifecycle event for this session.
      // The session's own emitter is still wired and will publish to the
      // bridge before the unsubscribe lands.
      session._emit({ type: 'session_closed', reason: 'requested' });
      try {
        await session._flushEventPersistence();
      } catch (err) {
        eventPersistenceError = err;
      }
    } else {
      this._emitter.emit({ type: 'session_closed', reason: 'requested' }, { sessionId: record.id });
    }

    try {
      await storage.releaseSessionLease({
        harnessName: record.harnessName,
        sessionId: record.id,
        ownerId: this.ownerId,
      });
    } catch {
      // Release is best-effort — record is already closed and the lease
      // will TTL out either way.
    }

    // Release the session's workspace under the configured ownership model.
    // `shared` is owned by the harness; nothing to release here.
    try {
      if (this._workspaceKind === 'per-session') {
        await this._workspaceRegistry.releasePerSession({ sessionId: record.id });
      } else if (this._workspaceKind === 'per-resource') {
        await this._workspaceRegistry.releasePerResource({ resourceId: record.resourceId });
      }
    } catch {
      // Best-effort — registry surfaces errors via workspace_error event.
    }

    const bridge = this._sessionEventBridges.get(record.id);
    if (bridge) {
      bridge();
      this._sessionEventBridges.delete(record.id);
    }
    this._liveSessions.delete(record.id);
    this._stopLeaseRenewalLoopIfIdle();

    if (eventPersistenceError !== undefined) {
      throw new HarnessStorageError(record.id, 'flush', eventPersistenceError);
    }
  }

  private async _forceDeleteSessionRecord(
    storage: HarnessStorage,
    rootRecord: SessionRecord,
    shouldContinue: () => boolean = () => true,
    scope: { resourceId?: string } = {},
  ): Promise<SessionRecord[]> {
    const latest = await storage.loadSession({ harnessName: rootRecord.harnessName, sessionId: rootRecord.id });
    if (!latest) return [];
    if (scope.resourceId !== undefined && latest.resourceId !== scope.resourceId) {
      throw new HarnessSessionNotFoundError(rootRecord.id);
    }
    const preCloseTree = await this._collectDeleteTree(storage, latest);
    const liveDeleteHandles = new Map<string, Session>();
    for (const node of preCloseTree) {
      const live = this._liveSessions.get(node.record.id);
      if (live) liveDeleteHandles.set(node.record.id, live);
    }
    if (latest.closedAt === undefined) {
      await this._closeSessionRecord(storage, latest, liveDeleteHandles, scope);
      if (!shouldContinue()) return [];
    }
    const closed = await storage.loadSession({ harnessName: rootRecord.harnessName, sessionId: rootRecord.id });
    if (!closed) return [];
    if (scope.resourceId !== undefined && closed.resourceId !== scope.resourceId) {
      throw new HarnessSessionNotFoundError(rootRecord.id);
    }
    const tree = await this._collectDeleteTree(storage, closed);
    if (!shouldContinue()) return [];
    const deleted = tree.map(node => node.record);
    await this._deleteClosedTree(storage, tree, liveDeleteHandles);
    return deleted;
  }

  private async _collectDeleteTree(storage: HarnessStorage, rootRecord: SessionRecord): Promise<CloseTreeNode[]> {
    const tree: CloseTreeNode[] = [{ record: rootRecord, depth: 0, leaseAcquired: false }];
    const seen = new Set<string>([rootRecord.id]);
    for (let index = 0; index < tree.length; index++) {
      const node = tree[index]!;
      const children = await storage.listSessions({
        harnessName: node.record.harnessName,
        resourceId: rootRecord.resourceId,
        includeClosed: true,
        parentSessionId: node.record.id,
      });
      for (const child of children) {
        if (seen.has(child.id)) continue;
        const stored = await storage.loadSession({ harnessName: node.record.harnessName, sessionId: child.id });
        if (!stored) continue;
        if (stored.resourceId !== rootRecord.resourceId) continue;
        seen.add(stored.id);
        tree.push({ record: stored, depth: node.depth + 1, leaseAcquired: false });
      }
    }
    return tree;
  }

  private _collectDeleteBlockers(tree: CloseTreeNode[]): string[] {
    const blockers: string[] = [];
    for (const node of tree) {
      const record = node.record;
      if (record.closedAt === undefined) blockers.push(`${record.id}:not_closed`);
      if ((record.pendingQueue?.length ?? 0) > 0) blockers.push(`${record.id}:pending_queue`);
      if (record.pendingResume !== undefined) blockers.push(`${record.id}:pending_resume`);
      for (const receipt of Object.values(record.queueAdmissionReceipts ?? {})) {
        if (
          receipt.status === 'queued' ||
          receipt.status === 'admitting' ||
          receipt.status === 'accepted' ||
          (receipt.status === 'completed' && receipt.postRunFinalizedAt === undefined)
        ) {
          blockers.push(`${record.id}:queue_receipt:${receipt.queuedItemId}`);
        }
      }
      for (const receipt of Object.values(record.inboxResponseReceipts ?? {})) {
        if (receipt.status === 'accepted' || receipt.retryable === true) {
          blockers.push(`${record.id}:inbox_receipt:${receipt.responseId}`);
        }
      }
    }
    return blockers;
  }

  private async _deleteClosedTree(
    storage: HarnessStorage,
    tree: CloseTreeNode[],
    deletedLiveSessions = new Map<string, Session>(),
  ): Promise<void> {
    const bottomUp = [...tree].sort((a, b) => b.depth - a.depth);
    // `_collectDeleteTree` builds the tree with the requested root at
    // `tree[0]` (depth 0) and descendants pushed afterwards. Capture the
    // root id so `_markDeletedSession` can emit the correct
    // `session_deleted.reason`: 'requested' for the explicitly-deleted
    // session, 'cascade' for every descendant cleaned up alongside it.
    const rootId = tree[0]?.record.id;
    // Tear down per-session workspace state from the persisted record before
    // the storage rows go away. `releaseDormant` resolves to a no-op for
    // sessions that are still live in `_perSession` (the close path already
    // released them) and for records that never persisted workspace state.
    // Best-effort: registry errors surface as workspace_error events.
    if (this._workspaceKind === 'per-session') {
      for (const node of bottomUp) {
        const wsState = node.record.workspace;
        if (!wsState) continue;
        // Let `HarnessWorkspaceProviderMismatchError` propagate so the delete
        // aborts before the row removal — the stored state is the only
        // breadcrumb the original provider has to clean its filesystem dir.
        // Other failures are best-effort: the registry already emitted
        // workspace_error.
        try {
          await this._workspaceRegistry.releaseDormant({
            sessionId: node.record.id,
            resourceId: node.record.resourceId,
            ...(node.record.parentSessionId !== undefined ? { parentSessionId: node.record.parentSessionId } : {}),
            storedProviderId: wsState.providerId,
            storedState: wsState.state,
          });
        } catch (err) {
          if (err instanceof HarnessWorkspaceProviderMismatchError) throw err;
          // Registry emits a workspace_error event on best-effort failure.
        }
      }
    }
    const sessions = bottomUp.map(node => ({
      harnessName: node.record.harnessName,
      sessionId: node.record.id,
      ifVersion: node.record.version,
      expectedResourceId: node.record.resourceId,
      expectedThreadId: node.record.threadId,
      expectedParentSessionId: node.record.parentSessionId ?? null,
      expectedCreatedAt: node.record.createdAt,
      requireClosed: true,
    }));
    if (storage.supportsAtomicDeleteSessions) {
      try {
        await storage.deleteSessions({ sessions });
      } catch (err) {
        for (const node of bottomUp) {
          let stillExists: SessionRecord | null;
          try {
            stillExists = await storage.loadSession({
              harnessName: node.record.harnessName,
              sessionId: node.record.id,
            });
          } catch {
            continue;
          }
          if (stillExists) continue;
          const live = this._markDeletedSession(
            node,
            deletedLiveSessions,
            node.record.id === rootId ? 'requested' : 'cascade',
          );
          // Preserve the original guarded-delete error; the caller already sees
          // this delete attempt as failed, and retry/reconciliation can clean up
          // any remaining operation evidence from this live session's active turn.
          await this._cleanupDeletedOperationEvidence(storage, node.record, live).catch(() => {});
        }
        throw err;
      }
      for (const node of bottomUp) {
        const live = this._markDeletedSession(
          node,
          deletedLiveSessions,
          node.record.id === rootId ? 'requested' : 'cascade',
        );
        await this._cleanupDeletedOperationEvidence(storage, node.record, live).catch(() => {});
      }
      return;
    }
    for (let index = 0; index < bottomUp.length; index++) {
      await storage.deleteSession(sessions[index]!);
      const node = bottomUp[index]!;
      const live = this._markDeletedSession(
        node,
        deletedLiveSessions,
        node.record.id === rootId ? 'requested' : 'cascade',
      );
      await this._cleanupDeletedOperationEvidence(storage, node.record, live).catch(() => {});
    }
  }

  private async _cleanupDeletedOperationEvidence(
    storage: HarnessStorage,
    record: SessionRecord,
    live: Session | undefined,
  ): Promise<void> {
    for (const signalId of live?._deletedOperationEvidenceSignalIds() ?? []) {
      await storage.deleteOperationAdmissionTombstonesForSession({
        harnessName: record.harnessName,
        sessionId: record.id,
        resourceId: record.resourceId,
        threadId: record.threadId,
        signalId,
      });
    }
  }

  private _markDeletedSession(
    node: CloseTreeNode,
    deletedLiveSessions: Map<string, Session>,
    reason: 'requested' | 'cascade',
  ): Session | undefined {
    const live = this._liveSessions.get(node.record.id) ?? deletedLiveSessions.get(node.record.id);
    const bridge = this._sessionEventBridges.get(node.record.id);
    // Emit session_deleted as the LAST event for this session, after
    // storage commits the delete so we never claim a delete that failed.
    // Coverage rules:
    //   - If a live Session is present, emit via its own emitter so
    //     session-level subscribers see the event.
    //   - If the bridge to the harness emitter has already been torn
    //     down (force-delete cascades close-first, which tears the
    //     bridge before we get here), emit directly on the harness
    //     emitter too so harness-level subscribers do not silently miss
    //     the terminal lifecycle.
    //   - If no live Session exists at all, emit only on the harness
    //     emitter (session-level subscribers were torn down with the
    //     Session instance during close).
    // Wrapped — best-effort terminal, never block the delete.
    try {
      if (live !== undefined) {
        live._emit({ type: 'session_deleted', reason });
        if (bridge === undefined) {
          this._emitter.emit({ type: 'session_deleted', reason }, { sessionId: node.record.id });
        }
      } else {
        this._emitter.emit({ type: 'session_deleted', reason }, { sessionId: node.record.id });
      }
    } catch {
      // Swallow — terminal lifecycle must not abort the delete path.
    }
    live?._markDeleted();
    if (bridge) {
      bridge();
      this._sessionEventBridges.delete(node.record.id);
    }
    this._liveSessions.delete(node.record.id);
    this._stopLeaseRenewalLoopIfIdle();
    return live;
  }

  /**
   * Read-only listing of session records for a resource. Closed records are
   * excluded unless `includeClosed: true`.
   */
  async listSessions(opts: SessionListOptions & { parentSessionId?: string }): Promise<SessionSummary[]> {
    const storage = this._requireStorage('listSessions()');
    return storage.listSessions({
      harnessName: this._harnessName,
      resourceId: opts.resourceId,
      includeClosed: opts.includeClosed,
      parentSessionId: opts.parentSessionId,
    });
  }

  /**
   * Inspect a single record by id. Returns `null` if no record exists; does
   * not throw on closed records (this is the inspection path). The active
   * resolver throws for closed; this method returns them when requested.
   */
  async loadSession(opts: SessionLoadByIdOptions): Promise<SessionRecord | null> {
    const storage = this._requireStorage('loadSession()');
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored) return null;
    if (stored.closedAt !== undefined && !opts.includeClosed) return null;
    return stored;
  }

  async getSessionEventReplayState(opts: {
    sessionId: string;
    resourceId: string;
  }): Promise<HarnessSessionEventReplayState | null> {
    const storage = this._requireStorage('getSessionEventReplayState()');
    if (!storage.capabilities().sessionEventReplay) {
      throw new HarnessEventReplayUnsupportedError('Harness.getSessionEventReplayState()');
    }
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored || stored.resourceId !== opts.resourceId) return null;
    try {
      return await storage.getSessionEventReplayState({
        harnessName: stored.harnessName,
        sessionId: stored.id,
        resourceId: stored.resourceId,
        threadId: stored.threadId,
      });
    } catch (err) {
      // Defense-in-depth: capability-true adapters that throw the storage
      // unsupported error on a specific call shape get translated here too.
      if (err instanceof HarnessStorageSessionEventReplayUnsupportedError) {
        throw new HarnessEventReplayUnsupportedError('Harness.getSessionEventReplayState()');
      }
      throw new HarnessStorageError(stored.id, 'load', err);
    }
  }

  async listSessionEventsAfter(opts: {
    sessionId: string;
    resourceId: string;
    epoch: string;
    afterSequence: number;
    limit: number;
  }): Promise<HarnessSessionEventRecord[]> {
    const storage = this._requireStorage('listSessionEventsAfter()');
    if (!storage.capabilities().sessionEventReplay) {
      throw new HarnessEventReplayUnsupportedError('Harness.listSessionEventsAfter()');
    }
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored || stored.resourceId !== opts.resourceId) return [];
    try {
      return await storage.listSessionEvents({
        harnessName: stored.harnessName,
        sessionId: stored.id,
        resourceId: stored.resourceId,
        threadId: stored.threadId,
        epoch: opts.epoch,
        afterSequence: opts.afterSequence,
        limit: opts.limit,
      });
    } catch (err) {
      if (err instanceof HarnessStorageSessionEventReplayUnsupportedError) {
        throw new HarnessEventReplayUnsupportedError('Harness.listSessionEventsAfter()');
      }
      throw new HarnessStorageError(stored.id, 'load', err);
    }
  }

  async lookupMessageResult(opts: {
    sessionId: string;
    resourceId: string;
    signalId: string;
  }): Promise<AgentSignalResultStatus | OperationAdmissionTombstone | null> {
    const storage = this._requireStorage('lookupMessageResult()');
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored || stored.resourceId !== opts.resourceId) return null;
    return storage.loadMessageResultEvidence({
      harnessName: stored.harnessName,
      sessionId: stored.id,
      resourceId: stored.resourceId,
      threadId: stored.threadId,
      signalId: opts.signalId,
    });
  }

  async lookupQueueResult(opts: {
    sessionId: string;
    resourceId: string;
    queuedItemId: string;
  }): Promise<QueueAdmissionReceipt | OperationAdmissionTombstone | null> {
    const storage = this._requireStorage('lookupQueueResult()');
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored || stored.resourceId !== opts.resourceId) return null;
    return storage.loadQueueResultEvidence({
      harnessName: stored.harnessName,
      sessionId: stored.id,
      resourceId: stored.resourceId,
      queuedItemId: opts.queuedItemId,
    });
  }

  async lookupInboxResponseResult(opts: {
    sessionId: string;
    resourceId: string;
    responseId: string;
  }): Promise<InboxResponseReceipt | null> {
    const storage = this._requireStorage('lookupInboxResponseResult()');
    if (opts.responseId.length === 0) {
      throw new HarnessValidationError(
        'lookupInboxResponseResult().responseId',
        'responseId must be a non-empty string',
      );
    }
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored || stored.resourceId !== opts.resourceId) return null;
    return stored.inboxResponseReceipts?.[opts.responseId] ?? null;
  }

  /**
   * Drain in-flight work and release every held lease. After `shutdown`,
   * `session()` rejects. Idempotent.
   */
  async shutdown(_opts?: ShutdownOptions): Promise<void> {
    if (this._shutdown) return;
    this._shutdown = true;

    await this.stopHeartbeats();

    const pendingInit = this._initPromise;
    if (pendingInit) {
      await Promise.allSettled([pendingInit]);
    }

    let workspacesShutdown = false;
    const shutdownWorkspaces = async () => {
      if (workspacesShutdown) return;
      workspacesShutdown = true;
      try {
        await this._workspaceRegistry.shutdown();
      } catch {
        // Best-effort: errors surface through the workspace_error event.
      }
      this._untrackBoundStorage();
    };

    let storage: HarnessStorage;
    try {
      storage = this._requireStorage('shutdown()');
    } catch {
      // No storage bound — nothing to release. Idempotent.
      this._liveSessions.clear();
      await shutdownWorkspaces();
      return;
    }

    try {
      const pendingCloses = new Set(this._closePromises.values());
      if (pendingCloses.size > 0) {
        await Promise.allSettled(pendingCloses);
      }

      this._stopLeaseRenewalLoop();

      // Release every held lease. We keep the records active in storage —
      // shutdown is not a close.
      const sessions = Array.from(this._liveSessions.values());
      let flushError: { sessionId: string; error: unknown } | undefined;
      for (const session of sessions) {
        // Surface eviction to harness-level subscribers BEFORE we tear down
        // the bridge so the event still propagates, and persist it before lease
        // handoff so a fast new owner resumes from the correct event sequence.
        session._emit({ type: 'session_evicted', reason: 'shutdown' });
        try {
          await session._flushEventPersistence();
        } catch (err) {
          flushError ??= { sessionId: session.id, error: err };
        }

        // Drain any in-flight record writes (e.g. the trailing token-usage
        // persist scheduled by `_recordTurnCompletion`) so a fresh harness
        // resumes from the latest CAS-acknowledged state. Defer storage errors
        // until after teardown so shutdown cannot leak workspaces or leases.
        try {
          await session._internalAwaitFlushChain();
        } catch (err) {
          flushError ??= { sessionId: session.id, error: err };
        }

        try {
          await storage.releaseSessionLease({
            harnessName: session.getRecord().harnessName,
            sessionId: session.id,
            ownerId: this.ownerId,
          });
        } catch {
          // Best-effort: leases TTL out anyway.
        }

        session._markEvicted(session.getRecord() as SessionRecord);

        const bridge = this._sessionEventBridges.get(session.id);
        if (bridge) {
          bridge();
          this._sessionEventBridges.delete(session.id);
        }
      }
      if (flushError !== undefined) {
        throw new HarnessStorageError(flushError.sessionId, 'flush', flushError.error);
      }
    } finally {
      this._liveSessions.clear();
      await shutdownWorkspaces();
    }
  }

  // -------------------------------------------------------------------------
  // Thread API (sidebar surface). See HARNESS_V1_SPEC.md §4.4 + §5.2.
  //
  // Threads are the durable artifact (message log + title), distinct from
  // the runtime Session. Every operation is resource-scoped — cross-resource
  // existence is never leaked. `delete` cascades through closeSession logic so
  // leases are released and child sessions are torn
  // down before the thread + messages are removed.
  // -------------------------------------------------------------------------

  threads = {
    create: async (opts: ThreadCreateOptions): Promise<ThreadRecord> => {
      const memory = await this._requireMemoryStorage('threads.create()');
      assertNoHarnessInternalThreadMetadata(opts.metadata, 'threads.create().metadata');
      const now = new Date();
      const threadId = opts.threadId ?? this._mintThreadId();
      const saveThread = (existing?: ThreadRecord | null) => {
        const metadata = {
          ...((existing?.metadata as Record<string, unknown> | undefined) ?? {}),
          ...((opts.metadata as Record<string, unknown> | undefined) ?? {}),
        };
        return memory.saveThread({
          thread: {
            id: threadId,
            resourceId: opts.resourceId,
            title: opts.title,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          },
        });
      };
      const saveThreadIfVisibleOwner = async (fence?: { assertActive(): Promise<void> }) => {
        const existing = await memory.getThreadById({ threadId });
        if (existing && existing.resourceId !== opts.resourceId) {
          throw new HarnessThreadNotFoundError(opts.resourceId, threadId);
        }
        await fence?.assertActive();
        return saveThread(existing);
      };
      let thread;
      if (opts.threadId === undefined) {
        thread = await saveThread();
      } else {
        try {
          thread = await this._requireStorage('threads.create()').withThreadDeleteFence(
            {
              threadId,
              ownerId: `${this.ownerId}:thread-create:${randomUUID()}`,
              ttlMs: Math.max(this._closeTimeoutMs, this._leaseTtlMs),
            },
            saveThreadIfVisibleOwner,
          );
        } catch (err) {
          if (err instanceof HarnessConfigError) {
            thread = await saveThreadIfVisibleOwner();
          } else {
            if (!isMissingThreadDeleteFenceImplementation(err)) throw err;
            thread = await saveThreadIfVisibleOwner();
          }
        }
      }
      const record = toThreadRecord(thread);
      this._emitter.emit({
        type: 'thread_created',
        threadId: record.id,
        resourceId: record.resourceId,
        title: record.title,
      });
      return record;
    },

    list: async (opts: ThreadListOptions): Promise<ThreadListResult> => {
      const memory = await this._requireMemoryStorage('threads.list()');
      assertNoHarnessInternalThreadMetadata(opts.metadata, 'threads.list().metadata');
      const out = await memory.listThreads({
        perPage: opts.perPage ?? 100,
        page: opts.page ?? 0,
        orderBy: opts.orderBy,
        filter: {
          resourceId: opts.resourceId,
          metadata: opts.metadata as Record<string, unknown> | undefined,
        },
      });
      return {
        threads: out.threads.map(toThreadRecord),
        total: out.total,
        perPage: out.perPage,
        page: out.page,
        hasMore: out.hasMore,
      };
    },

    get: async (opts: ThreadGetOptions): Promise<ThreadRecord | null> => {
      const memory = await this._requireMemoryStorage('threads.get()');
      const thread = await memory.getThreadById({ threadId: opts.threadId });
      if (!thread || thread.resourceId !== opts.resourceId) return null;
      return toThreadRecord(thread);
    },

    rename: async (opts: ThreadRenameOptions): Promise<ThreadRecord> => {
      const memory = await this._requireMemoryStorage('threads.rename()');
      assertNoHarnessInternalThreadMetadata(opts.metadata, 'threads.rename().metadata');
      const existing = await memory.getThreadById({ threadId: opts.threadId });
      if (!existing || existing.resourceId !== opts.resourceId) {
        throw new HarnessThreadNotFoundError(opts.resourceId, opts.threadId);
      }
      const previousTitle = existing.title;
      const merged: Record<string, unknown> = {
        ...((existing.metadata as Record<string, unknown> | undefined) ?? {}),
        ...((opts.metadata as Record<string, unknown> | undefined) ?? {}),
      };
      const updated = await memory.updateThread({
        id: opts.threadId,
        title: opts.title,
        metadata: merged,
      });
      const record = toThreadRecord(updated);
      this._emitter.emit({
        type: 'thread_renamed',
        threadId: record.id,
        resourceId: record.resourceId,
        title: opts.title,
        previousTitle,
      });
      return record;
    },

    clone: async (opts: ThreadCloneOptions): Promise<ThreadRecord> => {
      const memory = await this._requireMemoryStorage('threads.clone()');
      assertNoHarnessInternalThreadMetadata(opts.metadata, 'threads.clone().metadata');
      const source = await memory.getThreadById({ threadId: opts.threadId });
      if (!source || source.resourceId !== opts.resourceId) {
        throw new HarnessThreadNotFoundError(opts.resourceId, opts.threadId);
      }
      const cloned = await memory.cloneThread({
        sourceThreadId: opts.threadId,
        newThreadId: opts.newThreadId,
        resourceId: opts.resourceId,
        title: opts.title,
        metadata: opts.metadata as Record<string, unknown> | undefined,
        options: opts.messageLimit !== undefined ? { messageLimit: opts.messageLimit } : undefined,
      });
      const record = toThreadRecord(cloned.thread);
      this._emitter.emit({
        type: 'thread_cloned',
        threadId: record.id,
        resourceId: record.resourceId,
        sourceThreadId: opts.threadId,
        title: record.title,
      });
      return record;
    },

    selectOrCreate: async (opts: ThreadSelectOrCreateOptions): Promise<ThreadRecord> => {
      if (opts.threadId) {
        const existing = await this.threads.get({
          resourceId: opts.resourceId,
          threadId: opts.threadId,
        });
        if (existing) return existing;
        // Fall through and create a fresh thread with the requested id so the
        // caller can pin a stable URL without breaking resource isolation.
        return this.threads.create({
          resourceId: opts.resourceId,
          threadId: opts.threadId,
          title: opts.title,
          metadata: opts.metadata,
        });
      }
      return this.threads.create({
        resourceId: opts.resourceId,
        title: opts.title,
        metadata: opts.metadata,
      });
    },

    delete: async (opts: ThreadDeleteOptions): Promise<void> => {
      if (this._shutdown) return;
      const memory = await this._requireMemoryStorage('threads.delete()');
      if (this._shutdown) return;
      const existing = await memory.getThreadById({ threadId: opts.threadId });
      if (this._shutdown) return;
      if (!existing || existing.resourceId !== opts.resourceId) {
        // Idempotent: deleting a missing or foreign-owned thread is a no-op
        // from the caller's perspective. Cross-resource existence is never
        // leaked.
        return;
      }
      if (hasExternalSessionStorageOwner(existing.metadata)) {
        throw new HarnessConfigError(
          'sessions.storage',
          'threads.delete() cannot delete global memory thread rows after a separate Harness session storage has attached to this thread',
        );
      }

      // Cascade: force-delete every session rooted on this thread before
      // deleting the thread so descendants, leases, and owned attachments are
      // cleaned through the same session lifecycle path. Without Harness
      // session storage we cannot prove cross-process ownership, so deletion
      // fails closed before mutating global memory rows.
      let storage: HarnessStorage;
      try {
        storage = this._requireStorage('threads.delete()');
      } catch (err) {
        if (!(err instanceof HarnessConfigError)) throw err;
        throw new HarnessConfigError(
          'sessions.storage',
          'threads.delete() requires Harness session storage so it can prove thread ownership before deleting global memory thread rows',
        );
      }
      if (!this._canDeleteGlobalMemoryThreadWithStorage(storage, memory)) {
        throw new HarnessConfigError(
          'sessions.storage',
          'threads.delete() cannot cascade with a separate session storage override because MemoryStorage.deleteThread deletes global thread rows',
        );
      }
      let cascaded = false;
      let deletedRootThread = false;
      const rootDeleteMarked = await this._setThreadDeleteInProgress(memory, opts.threadId, true, opts.resourceId);
      try {
        while (!this._shutdown) {
          try {
            await storage.withThreadDeleteFence(
              {
                threadId: opts.threadId,
                ownerId: `${this.ownerId}:thread-delete:${randomUUID()}`,
                ttlMs: Math.max(this._closeTimeoutMs, this._leaseTtlMs),
              },
              async rootFence => {
                if (this._shutdown) return;
                // Preflight before deleting session rows: custom adapters must
                // prove they can see active thread owners across their visible
                // namespaces before we mutate storage or global memory rows.
                await storage.listActiveSessionsByThread({ threadId: opts.threadId });
                const candidates = await storage.listSessionsByThread({
                  harnessName: this._harnessName,
                  resourceId: opts.resourceId,
                  threadId: opts.threadId,
                  includeClosed: true,
                });
                if (this._shutdown) return;
                for (const candidate of candidates) {
                  const stored = await storage.loadSession({
                    harnessName: this._harnessName,
                    sessionId: candidate.id,
                  });
                  if (!stored || stored.threadId !== opts.threadId || stored.resourceId !== opts.resourceId) continue;
                  cascaded = true;
                  const deletedRecords = await this._forceDeleteSessionRecord(storage, stored, () => !this._shutdown, {
                    resourceId: opts.resourceId,
                  });
                  for (const deleted of deletedRecords) {
                    if (this._shutdown) return;
                    if (!deleted.ownsThread || deleted.threadId === opts.threadId) continue;
                    try {
                      await storage.withThreadDeleteFence(
                        {
                          threadId: deleted.threadId,
                          ownerId: `${this.ownerId}:thread-delete:${randomUUID()}`,
                          ttlMs: Math.max(this._closeTimeoutMs, this._leaseTtlMs),
                        },
                        async descendantFence => {
                          const descendantDeleteMarked = await this._setThreadDeleteInProgress(
                            memory,
                            deleted.threadId,
                            true,
                            deleted.resourceId,
                          );
                          let deletedDescendantThread = false;
                          try {
                            const deletedThread = await memory.getThreadById({ threadId: deleted.threadId });
                            if (!deletedThread || deletedThread.resourceId !== deleted.resourceId) return;
                            if (hasExternalSessionStorageOwner(deletedThread.metadata)) return;
                            const activeThreadSessions = await storage.listActiveSessionsByThread({
                              threadId: deleted.threadId,
                            });
                            if (activeThreadSessions.length > 0) return;
                            const remainingThreadSessions = await storage.listSessionsByThread({
                              threadId: deleted.threadId,
                              includeClosed: true,
                            });
                            if (remainingThreadSessions.length > 0) return;
                            if (!this._canDeleteGlobalMemoryThreadWithStorage(storage, memory)) return;
                            if (await this._hasVisibleHarnessSessionsForThread(storage, deleted.threadId)) return;
                            await descendantFence.assertActive();
                            await memory.deleteThread({ threadId: deleted.threadId });
                            deletedDescendantThread = true;
                            if (this._shutdown) return;
                            if (memory.supportsObservationalMemory) {
                              await memory.clearObservationalMemory(deleted.threadId, deleted.resourceId);
                            }
                          } finally {
                            if (descendantDeleteMarked && !deletedDescendantThread) {
                              await this._setThreadDeleteInProgress(
                                memory,
                                deleted.threadId,
                                false,
                                deleted.resourceId,
                              );
                            }
                          }
                        },
                      );
                    } catch (err) {
                      if (err instanceof HarnessStorageThreadDeleteFenceConflictError) continue;
                      throw err;
                    }
                  }
                  if (this._shutdown) return;
                }

                const activeRootThreadSessions = await storage.listActiveSessionsByThread({
                  threadId: opts.threadId,
                });
                if (activeRootThreadSessions.length > 0) {
                  return;
                }
                const remainingRootThreadSessions = await storage.listSessionsByThread({
                  threadId: opts.threadId,
                  includeClosed: true,
                });
                if (remainingRootThreadSessions.length > 0) {
                  return;
                }
                const rootThread = await memory.getThreadById({ threadId: opts.threadId });
                if (!rootThread || rootThread.resourceId !== opts.resourceId) {
                  return;
                }
                if (hasExternalSessionStorageOwner(rootThread.metadata)) {
                  return;
                }
                if (!this._canDeleteGlobalMemoryThreadWithStorage(storage, memory)) {
                  return;
                }
                if (await this._hasVisibleHarnessSessionsForThread(storage, opts.threadId)) {
                  return;
                }
                await rootFence.assertActive();
                await memory.deleteThread({ threadId: opts.threadId });
                deletedRootThread = true;
                if (memory.supportsObservationalMemory) {
                  await memory.clearObservationalMemory(opts.threadId, opts.resourceId);
                }
              },
            );
            break;
          } catch (err) {
            if (
              err instanceof HarnessStorageThreadDeleteFenceConflictError &&
              err.ownerId?.includes(':thread-delete:')
            ) {
              await waitForThreadDeleteFenceRetry();
              continue;
            }
            throw err;
          }
        }
      } finally {
        if (rootDeleteMarked && !deletedRootThread) {
          await this._setThreadDeleteInProgress(memory, opts.threadId, false, opts.resourceId);
        }
      }
      if (!deletedRootThread) return;
      this._emitter.emit({
        type: 'thread_deleted',
        threadId: opts.threadId,
        resourceId: opts.resourceId,
        // Historical event field name. For Harness v1 this now means a
        // session subtree cascade ran; the cascade hard-deletes after close.
        cascadedSessionClose: cascaded,
      });
    },

    /**
     * Shallow-merges `patch` into the thread's `metadata`. Keys whose values
     * are `undefined` in the patch are removed from the stored metadata. The
     * patch is otherwise a verbatim overwrite — nested objects are replaced,
     * not deep-merged, matching `Session.setState()` semantics.
     *
     * Emits `thread_settings_changed` only when the on-disk metadata actually
     * differs from the prior state, so subscribers can treat the event as a
     * real change signal rather than a write-acknowledgement.
     *
     * Throws `HarnessThreadNotFoundError` if the thread does not exist or
     * is owned by a different resource — cross-resource existence is never
     * leaked.
     */
    setSettings: async (opts: ThreadSetSettingsOptions): Promise<void> => {
      const memory = await this._requireMemoryStorage('threads.setSettings()');
      const existing = await memory.getThreadById({ threadId: opts.threadId });
      if (!existing || existing.resourceId !== opts.resourceId) {
        throw new HarnessThreadNotFoundError(opts.resourceId, opts.threadId);
      }

      const before = (existing.metadata as Record<string, unknown> | undefined) ?? {};
      const next: Record<string, unknown> = { ...before };
      const effectivePatch: Record<string, unknown> = {};
      const removedKeys: string[] = [];

      for (const [key, value] of Object.entries(opts.patch)) {
        if (HARNESS_INTERNAL_THREAD_METADATA_KEYS.has(key)) {
          throw new HarnessConfigError(
            'threads.setSettings().patch',
            `metadata key "${key}" is reserved for Harness internals`,
          );
        }
        if (value === undefined) {
          if (key in next) {
            delete next[key];
            removedKeys.push(key);
          }
          continue;
        }
        // Only record real diffs so the event reflects actual change.
        if (!Object.is(before[key], value)) {
          next[key] = value;
          effectivePatch[key] = value;
        }
      }

      if (Object.keys(effectivePatch).length === 0 && removedKeys.length === 0) {
        // No-op write — skip the storage round trip and the event.
        return;
      }

      await memory.saveThread({
        thread: {
          ...existing,
          metadata: Object.keys(next).length > 0 ? next : undefined,
          updatedAt: new Date(),
        },
      });

      this._emitter.emit({
        type: 'thread_settings_changed',
        threadId: opts.threadId,
        resourceId: opts.resourceId,
        patch: effectivePatch,
        removedKeys,
      });
    },

    /**
     * Returns a frozen snapshot of the thread's metadata. An empty object is
     * returned when the thread has no metadata. Throws
     * `HarnessThreadNotFoundError` if the thread does not exist or is owned
     * by a different resource.
     */
    getSettings: async (opts: ThreadGetSettingsOptions): Promise<Readonly<Record<string, unknown>>> => {
      const memory = await this._requireMemoryStorage('threads.getSettings()');
      const existing = await memory.getThreadById({ threadId: opts.threadId });
      if (!existing || existing.resourceId !== opts.resourceId) {
        throw new HarnessThreadNotFoundError(opts.resourceId, opts.threadId);
      }
      const metadata = (existing.metadata as Record<string, unknown> | undefined) ?? {};
      return Object.freeze(stripHarnessInternalThreadMetadata(metadata) ?? {});
    },

    /**
     * Convenience accessor for a single setting. Returns `undefined` when the
     * key is absent. Throws `HarnessThreadNotFoundError` if the thread does
     * not exist or is owned by a different resource.
     */
    getSetting: async (opts: ThreadGetSettingOptions): Promise<unknown> => {
      const settings = await this.threads.getSettings({
        resourceId: opts.resourceId,
        threadId: opts.threadId,
      });
      return settings[opts.key];
    },
  };

  // -------------------------------------------------------------------------
  // §9 — `harness.models.*` (catalog + auth status). The catalog is static,
  // declared at construction. Auth status is resolved on demand because it
  // changes out-of-band (login flows, expiring tokens) and the harness has
  // no signal to invalidate a cache on.
  // -------------------------------------------------------------------------

  models = {
    /**
     * Returns a frozen snapshot of every catalog entry in declaration order.
     * The catalog is intentionally a pure UX surface — callers can render a
     * picker without reaching into provider plumbing. Empty array when the
     * harness was configured without a `models` list.
     */
    list: async (): Promise<readonly ModelInfo[]> => {
      return Object.freeze(Array.from(this._modelCatalog.values()));
    },

    /**
     * Returns the catalog entry for `modelId`, or `null` if no such entry
     * exists. Async to match the rest of `harness.models.*` and leave room
     * for backend-backed catalogs without a breaking change.
     */
    get: async (modelId: string): Promise<ModelInfo | null> => {
      return this._modelCatalog.get(modelId) ?? null;
    },

    /**
     * Resolves the current auth status for a catalog `modelId`. Calls the
     * configured {@link HarnessConfigCommon.modelAuthStatusResolver}; if
     * none was supplied, returns `'unknown'`.
     *
     * Throws `HarnessModelNotFoundError` when `modelId` is not in the
     * catalog. Typos surface immediately rather than collapsing into a
     * spurious `'unknown'` reading.
     */
    getAuthStatus: async (modelId: string): Promise<ModelAuthStatus> => {
      if (!this._modelCatalog.has(modelId)) {
        throw new HarnessModelNotFoundError(modelId);
      }
      if (!this._modelAuthStatusResolver) return 'unknown';
      return await this._modelAuthStatusResolver(modelId);
    },
  };

  getFileConfig(): Readonly<HarnessFileConfig> {
    return Object.freeze({
      ...this._fileConfig,
      ...(this._fileConfig.allowedUrlMimeTypes
        ? { allowedUrlMimeTypes: Object.freeze([...this._fileConfig.allowedUrlMimeTypes]) }
        : {}),
    });
  }

  attachments = {
    upload: async (opts: AttachmentUploadOptions): Promise<AttachmentRef> => {
      const storage = this._requireStorage('attachments.upload()');
      const session = await this.session(
        opts.resourceId ? { sessionId: opts.sessionId, resourceId: opts.resourceId } : { sessionId: opts.sessionId },
      );
      const metadata =
        opts.metadata === undefined
          ? undefined
          : assertAttachmentJsonRecord(opts.metadata, 'attachments.upload().metadata');
      let upload: {
        name: string;
        mimeType: string;
        data: Uint8Array;
        semantic: AttachmentSemanticMetadata;
      };
      if (opts.kind === 'primitive') {
        upload = {
          name: opts.name,
          mimeType: opts.mimeType ?? 'application/json',
          data: encodeAttachmentJson(assertAttachmentJsonValue(opts.value, 'attachments.upload().value')),
          semantic: {
            kind: 'primitive',
            primitiveType: opts.primitiveType,
            ...(metadata ? { metadata } : {}),
          },
        };
      } else if (opts.kind === 'element') {
        upload = {
          name: opts.name,
          mimeType: opts.mimeType ?? 'application/vnd.mastra.harness.element+json',
          data: encodeAttachmentJson(assertAttachmentJsonValue(opts.payload, 'attachments.upload().payload')),
          semantic: {
            kind: 'element',
            elementType: opts.elementType,
            ...(opts.renderer ? { renderer: { ...opts.renderer } } : {}),
            ...(opts.schemaId ? { schemaId: opts.schemaId } : {}),
            ...(metadata ? { metadata } : {}),
          },
        };
      } else {
        upload = {
          name: opts.filename,
          mimeType: opts.contentType,
          data:
            opts.data instanceof Uint8Array
              ? new Uint8Array(opts.data)
              : new Uint8Array(await new Response(opts.data).arrayBuffer()),
          semantic: {
            kind: 'file',
            ...(metadata ? { metadata } : {}),
          },
        };
      }
      const internalOpts = opts as { attachmentId?: unknown; source?: AttachmentSource };
      const source = internalOpts.source === 'url' ? 'url' : 'preupload';
      if (
        internalOpts.attachmentId !== undefined &&
        (typeof internalOpts.attachmentId !== 'string' || internalOpts.attachmentId.length === 0)
      ) {
        throw new HarnessValidationError('attachments.upload().attachmentId', 'must be a non-empty string');
      }
      const attachmentId = internalOpts.attachmentId ?? `attachment-${randomUUID()}`;
      const sha256 = createHash('sha256').update(upload.data).digest('hex');
      const existing = await storage.getAttachmentRecord({
        harnessName: session.getRecord().harnessName,
        sessionId: session.id,
        attachmentId,
      });
      if (existing) {
        const existingSemantic = attachmentSemanticFromRecord(existing);
        if (
          existing.name !== upload.name ||
          existing.mimeType !== upload.mimeType ||
          existing.bytes !== upload.data.byteLength ||
          existing.sha256 !== sha256 ||
          existing.source !== source ||
          !attachmentSemanticMatches(existingSemantic, upload.semantic)
        ) {
          throw new HarnessAttachmentUnavailableError(session.id, 'digest_mismatch', attachmentId);
        }
        return {
          attachmentId: existing.attachmentId,
          resourceId: session.resourceId,
          ownerSessionId: session.id,
          bytes: existing.bytes,
          sha256: existing.sha256,
          source: existing.source,
          name: existing.name,
          mimeType: existing.mimeType,
          ...existingSemantic,
        };
      }
      const saved = await storage.saveAttachment({
        harnessName: session.getRecord().harnessName,
        sessionId: session.id,
        attachmentId,
        name: upload.name,
        mimeType: upload.mimeType,
        source,
        data: upload.data,
        semantic: upload.semantic,
      });
      const savedRecord = await storage.getAttachmentRecord({
        harnessName: session.getRecord().harnessName,
        sessionId: session.id,
        attachmentId,
      });
      const savedSemantic = savedRecord ? attachmentSemanticFromRecord(savedRecord) : undefined;
      if (
        !savedRecord ||
        savedRecord.name !== upload.name ||
        savedRecord.mimeType !== upload.mimeType ||
        saved.bytes !== upload.data.byteLength ||
        saved.sha256 !== sha256 ||
        savedRecord.source !== source ||
        savedRecord.bytes !== upload.data.byteLength ||
        savedRecord.sha256 !== sha256 ||
        !savedSemantic ||
        !attachmentSemanticMatches(savedSemantic, upload.semantic)
      ) {
        throw new HarnessAttachmentUnavailableError(session.id, 'digest_mismatch', attachmentId);
      }
      return {
        attachmentId: savedRecord.attachmentId,
        resourceId: session.resourceId,
        ownerSessionId: session.id,
        bytes: savedRecord.bytes,
        sha256: savedRecord.sha256,
        source,
        name: upload.name,
        mimeType: upload.mimeType,
        ...savedSemantic,
      };
    },
    delete: async (opts: AttachmentDeleteOptions): Promise<void> => {
      const storage = this._requireStorage('attachments.delete()');
      const session = await this.session(
        opts.resourceId ? { sessionId: opts.sessionId, resourceId: opts.resourceId } : { sessionId: opts.sessionId },
      );
      try {
        await storage.deleteAttachment({
          harnessName: session.getRecord().harnessName,
          sessionId: session.id,
          attachmentId: opts.attachmentId,
        });
      } catch (err) {
        if (err instanceof HarnessStorageAttachmentInUseError) {
          throw new HarnessAttachmentInUseError(err.sessionId, err.attachmentId, err.references);
        }
        throw err;
      }
    },
  };

  // -------------------------------------------------------------------------
  // Artifacts.
  //
  // Immutable, versioned work products produced during a session — plans,
  // diffs, test reports, screenshots, patches, review output. Content is
  // referenced via an attachment (caller uploads via
  // `harness.attachments.upload` first, then passes the resulting
  // `attachmentId` to `artifacts.write`). Hash/MIME/bytes are copied from
  // the attachment record so the artifact captures canonical, immutable
  // values. Versioning is captured via `parentArtifactId` +
  // `lineageRootId` + `version`, computed storage-side under CAS.
  // -------------------------------------------------------------------------

  artifacts = Object.freeze({
    write: async (input: {
      sessionId: string;
      resourceId: string;
      threadId: string;
      artifactId: string;
      artifactType: HarnessArtifactRecord['artifactType'];
      attachmentId: string;
      parentArtifactId?: string;
      schemaUri?: string;
      createdBy?: HarnessArtifactRecord['createdBy'];
      metadata?: HarnessArtifactRecord['metadata'];
    }): Promise<HarnessArtifactRecord> => {
      const storage = this._requireStorage('artifacts.write()');
      if (!storage.capabilities().harnessArtifacts) {
        throw new HarnessArtifactsUnsupportedError('Harness.artifacts.write()');
      }
      let record: HarnessArtifactRecord;
      try {
        record = await storage.writeArtifact({
          harnessName: this._harnessName,
          sessionId: input.sessionId,
          resourceId: input.resourceId,
          threadId: input.threadId,
          artifactId: input.artifactId,
          artifactType: input.artifactType,
          attachmentId: input.attachmentId,
          ...(input.parentArtifactId !== undefined ? { parentArtifactId: input.parentArtifactId } : {}),
          ...(input.schemaUri !== undefined ? { schemaUri: input.schemaUri } : {}),
          createdBy: input.createdBy ?? {},
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        });
      } catch (err) {
        if (err instanceof HarnessStorageArtifactsUnsupportedError) {
          throw new HarnessArtifactsUnsupportedError('Harness.artifacts.write()');
        }
        if (err instanceof HarnessStorageArtifactNotFoundError) {
          throw new HarnessArtifactNotFoundError(err.artifactId);
        }
        if (err instanceof HarnessStorageArtifactDuplicateIdError) {
          throw new HarnessArtifactDuplicateIdError(err.artifactId);
        }
        if (err instanceof HarnessStorageArtifactAttachmentMissingError) {
          throw new HarnessArtifactAttachmentMissingError(err.attachmentId);
        }
        if (err instanceof HarnessStorageArtifactLineageMismatchError) {
          throw new HarnessArtifactLineageMismatchError(err.parentArtifactId, err.reason);
        }
        if (err instanceof HarnessStorageArtifactVersionConflictError) {
          throw new HarnessArtifactVersionConflictError(err.lineageRootId, err.version);
        }
        throw err;
      }
      // Emit on the live session's emitter (so session-level subscribers
      // see it and the harness bridge forwards to harness-level
      // subscribers). When the writer holds no live Session handle —
      // e.g. a server-route caller without a live session in this
      // process — fall back to the harness emitter so harness-level
      // subscribers still observe the lifecycle.
      const live = this._liveSessions.get(input.sessionId);
      const event = {
        type: 'artifact_created' as const,
        artifactId: record.artifactId,
        artifactType: record.artifactType,
        lineageRootId: record.lineageRootId,
        ...(record.parentArtifactId !== undefined ? { parentArtifactId: record.parentArtifactId } : {}),
        version: record.version,
        mimeType: record.mimeType,
        sha256: record.sha256,
        bytes: record.bytes,
      };
      try {
        if (live !== undefined) {
          live._emit(event);
        } else {
          this._emitter.emit(event, { sessionId: input.sessionId });
        }
      } catch {
        // Emitter failure must never block the artifact write.
      }
      return record;
    },

    get: async (opts: {
      sessionId: string;
      resourceId: string;
      artifactId: string;
    }): Promise<HarnessArtifactRecord | null> => {
      const storage = this._requireStorage('artifacts.get()');
      if (!storage.capabilities().harnessArtifacts) {
        throw new HarnessArtifactsUnsupportedError('Harness.artifacts.get()');
      }
      try {
        return await storage.loadArtifact({
          harnessName: this._harnessName,
          sessionId: opts.sessionId,
          resourceId: opts.resourceId,
          artifactId: opts.artifactId,
        });
      } catch (err) {
        if (err instanceof HarnessStorageArtifactsUnsupportedError) {
          throw new HarnessArtifactsUnsupportedError('Harness.artifacts.get()');
        }
        throw err;
      }
    },

    list: async (opts: {
      sessionId: string;
      resourceId: string;
      artifactType?: HarnessArtifactRecord['artifactType'];
      limit?: number;
      cursor?: string;
    }): Promise<HarnessArtifactRecord[]> => {
      const storage = this._requireStorage('artifacts.list()');
      if (!storage.capabilities().harnessArtifacts) {
        throw new HarnessArtifactsUnsupportedError('Harness.artifacts.list()');
      }
      try {
        return await storage.listArtifacts({
          harnessName: this._harnessName,
          sessionId: opts.sessionId,
          resourceId: opts.resourceId,
          ...(opts.artifactType !== undefined ? { artifactType: opts.artifactType } : {}),
          limit: opts.limit ?? 100,
          ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
        });
      } catch (err) {
        if (err instanceof HarnessStorageArtifactsUnsupportedError) {
          throw new HarnessArtifactsUnsupportedError('Harness.artifacts.list()');
        }
        throw err;
      }
    },

    versions: async (opts: {
      sessionId: string;
      resourceId: string;
      artifactId: string;
    }): Promise<HarnessArtifactRecord[]> => {
      const storage = this._requireStorage('artifacts.versions()');
      if (!storage.capabilities().harnessArtifacts) {
        throw new HarnessArtifactsUnsupportedError('Harness.artifacts.versions()');
      }
      try {
        return await storage.listArtifactVersions({
          harnessName: this._harnessName,
          sessionId: opts.sessionId,
          resourceId: opts.resourceId,
          artifactId: opts.artifactId,
        });
      } catch (err) {
        if (err instanceof HarnessStorageArtifactsUnsupportedError) {
          throw new HarnessArtifactsUnsupportedError('Harness.artifacts.versions()');
        }
        throw err;
      }
    },
  });

  // -------------------------------------------------------------------------
  // Permissions — profile registry + apply convenience.
  //
  // Profiles are declarative permission baselines (read-only review,
  // approval-gated patch, ci-fixer, trusted local YOLO) intended for
  // server / A2A / channel routes that need a non-YOLO posture the
  // local CLI's lenient defaults cannot bypass. `applyProfile`
  // resolves the named session and delegates to the session-level
  // `permissions.applyProfile()` so audit + emission stay in one
  // place.
  // -------------------------------------------------------------------------

  permissions = Object.freeze({
    profiles: Object.freeze({
      get: (name: HarnessPermissionProfileName): HarnessPermissionProfile | undefined =>
        HARNESS_PERMISSION_PROFILES[name],
      list: (): readonly HarnessPermissionProfile[] =>
        Object.values(HARNESS_PERMISSION_PROFILES) as readonly HarnessPermissionProfile[],
    }),
    applyProfile: async (opts: {
      sessionId: string;
      resourceId: string;
      profileName: HarnessPermissionProfileName;
      preserveCallerDenies?: boolean;
    }): Promise<void> => {
      const session = await this.session({ sessionId: opts.sessionId, resourceId: opts.resourceId });
      await session.permissions.applyProfile({
        profileName: opts.profileName,
        ...(opts.preserveCallerDenies !== undefined ? { preserveCallerDenies: opts.preserveCallerDenies } : {}),
      });
    },
  });

  // -------------------------------------------------------------------------
  // Internals.
  // -------------------------------------------------------------------------

  private _requireStorage(callsite: string): HarnessStorage {
    if (this._storageOverride) return this._storageOverride;
    if (this._mastra) {
      const composite = this._mastra.getStorage();
      // Domain access goes through getStore() everywhere else in the codebase
      // — keep this consistent so adapters that override the accessor (e.g.
      // to add caching or lazy init) plug in transparently. Synchronously
      // available because all current adapters resolve domains eagerly, but
      // we still resolve via the accessor rather than poking `.stores.harness`
      // directly.
      const harness = composite?.stores?.harness;
      if (harness) return harness;
    }
    throw new HarnessConfigError(
      'sessions.storage',
      `required for ${callsite} — pass storage in HarnessConfig.storage, HarnessConfig.sessions.storage, or via the Mastra instance backing this harness`,
    );
  }

  private _canDeleteGlobalMemoryThreadWithStorage(storage: HarnessStorage, memory: object): boolean {
    const mastra = this._mastra;
    if (!mastra || mastra.getStorage()?.stores?.harness !== storage) return false;
    const boundHarnesses = boundHarnessesByMemory.get(memory);
    if (!boundHarnesses) return false;
    for (const harness of boundHarnesses) {
      if (harness._getEffectiveSessionStorage() !== storage) return false;
    }
    return true;
  }

  private _trackMemoryStorage(memory: unknown): void {
    if (!memory || typeof memory !== 'object') return;
    let boundHarnesses = boundHarnessesByMemory.get(memory);
    if (!boundHarnesses) {
      boundHarnesses = new Set();
      boundHarnessesByMemory.set(memory, boundHarnesses);
    }
    boundHarnesses.add(this);
  }

  private _untrackBoundStorage(): void {
    const mastra = this._mastra;
    if (mastra) {
      boundHarnessesByMastra.get(mastra)?.delete(this);
      this._untrackMemoryStorage(mastra.getStorage()?.stores?.memory);
    }
  }

  private _untrackMemoryStorage(memory: unknown): void {
    if (!memory || typeof memory !== 'object') return;
    boundHarnessesByMemory.get(memory)?.delete(this);
  }

  private _getEffectiveSessionStorage(): HarnessStorage | undefined {
    return this._storageOverride ?? this._mastra?.getStorage()?.stores?.harness;
  }

  /** @internal — used by Harness wakeup workers to honor session storage overrides. */
  _internalGetSessionStorage(): HarnessStorage | undefined {
    return this._getEffectiveSessionStorage();
  }

  private _usesSeparateSessionStorage(): boolean {
    if (!this._storageOverride) return false;
    return this._storageOverride !== this._mastra?.getStorage()?.stores?.harness;
  }

  private async _markExternalSessionStorageOwner(
    threadId: string,
    opts: { requireExisting?: boolean } = {},
  ): Promise<void> {
    if (!this._usesSeparateSessionStorage()) return;
    const memory = await this._internalTryGetMemoryStorage();
    if (!memory) return;
    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      if (opts.requireExisting === false) return;
      throw new HarnessConfigError(
        'sessions.storage',
        'session() cannot attach a separate session storage to a memory thread that does not exist',
      );
    }
    if (hasHarnessThreadDeleteInProgress(thread.metadata)) {
      throw new HarnessConfigError(
        'sessions.storage',
        'session() cannot attach a separate session storage to a memory thread while threads.delete() is in progress',
      );
    }
    const hadExternalOwner = hasExternalSessionStorageOwner(thread.metadata);
    if (hadExternalOwner) return;
    await memory.updateThread({
      id: threadId,
      title: thread.title ?? '',
      metadata: {
        ...(thread.metadata as Record<string, unknown> | undefined),
        [EXTERNAL_SESSION_STORAGE_OWNER_METADATA_KEY]: true,
      },
    });
    const marked = await memory.getThreadById({ threadId });
    if (hasHarnessThreadDeleteInProgress(marked?.metadata)) {
      await memory.updateThread({
        id: threadId,
        title: marked?.title ?? thread.title ?? '',
        metadata: {
          ...((marked?.metadata as Record<string, unknown> | undefined) ?? {}),
          [EXTERNAL_SESSION_STORAGE_OWNER_METADATA_KEY]: false,
        },
      });
      throw new HarnessConfigError(
        'sessions.storage',
        'session() cannot attach a separate session storage to a memory thread while threads.delete() is in progress',
      );
    }
  }

  private async _setThreadDeleteInProgress(
    memory: MemoryStorage,
    threadId: string,
    value: boolean,
    resourceId?: string,
  ): Promise<boolean> {
    const thread = await memory.getThreadById({ threadId });
    if (!thread || (resourceId !== undefined && thread.resourceId !== resourceId)) return false;
    await memory.updateThread({
      id: threadId,
      title: thread.title ?? '',
      metadata: {
        ...(thread.metadata as Record<string, unknown> | undefined),
        [HARNESS_THREAD_DELETE_IN_PROGRESS_METADATA_KEY]: value,
      },
    });
    return true;
  }

  private async _hasVisibleHarnessSessionsForThread(storage: HarnessStorage, threadId: string): Promise<boolean> {
    const sessions = await storage.listSessionsByThread({
      threadId,
      includeClosed: true,
    });
    return sessions.length > 0;
  }

  /**
   * Thread CRUD is owned by Mastra's memory storage domain, not by the
   * harness storage domain. We resolve it lazily through the bound Mastra
   * instance via `getStore('memory')` — the harness never persists threads
   * itself.
   */
  private async _requireMemoryStorage(callsite: string) {
    if (!this._mastra) {
      throw new HarnessConfigError(
        'mastra',
        `required for ${callsite} — thread CRUD needs a Mastra instance bound to this harness so we can access the memory storage domain`,
      );
    }
    const composite = this._mastra.getStorage();
    if (!composite) {
      throw new HarnessConfigError(
        'storage',
        `required for ${callsite} — the bound Mastra instance has no storage configured`,
      );
    }
    const memory = await composite.getStore('memory');
    if (!memory) {
      throw new HarnessConfigError(
        'storage.memory',
        `required for ${callsite} — the bound Mastra storage has no memory domain registered`,
      );
    }
    this._trackMemoryStorage(memory);
    return memory;
  }

  /**
   * @internal — Session-facing soft variant of `_requireMemoryStorage`. Returns
   * `null` when memory storage is not configured instead of throwing, so
   * read-only consumers (e.g. `Session.listMessages`) can gracefully return an
   * empty history for ad-hoc threads without crashing.
   */
  async _internalTryGetMemoryStorage() {
    if (!this._mastra) return null;
    const composite = this._mastra.getStorage();
    if (!composite) return null;
    const memory = await composite.getStore('memory');
    this._trackMemoryStorage(memory);
    return memory ?? null;
  }

  private _mintThreadId(): string {
    return `thread-${randomUUID()}`;
  }

  /**
   * @internal — used by `Session.cancel(...)` to walk the subagent
   * tree at cancellation time. Returns undefined when the session is
   * not currently live in this Harness instance.
   */
  _internalGetLiveSession(sessionId: string): Session | undefined {
    return this._liveSessions.get(sessionId);
  }

  /** @internal — exposed for inspection in tests. */
  _internalLiveSessionCount(): number {
    return this._liveSessions.size;
  }

  /** @internal — accessor for `Session.queue()` admission caps. */
  get _internalMaxQueueDepth(): number {
    return this._maxQueueDepth;
  }

  /** @internal — accessor for `Session.queue()` full-queue behavior. */
  get _internalQueueBackpressure(): HarnessQueueBackpressurePolicy {
    return this._queueBackpressure;
  }

  /** @internal — default lease TTL the heartbeat uses. Read by
   * `Session.extendLease(...)` to clamp `ttlMs` upward so an extension
   * cannot shrink an already-default-TTL lease. */
  get _internalLeaseTtlMs(): number {
    return this._leaseTtlMs;
  }

  /** @internal — workspace policy for the runtime to evaluate against
   * classified actions before execution and when journaling. Returns
   * `undefined` when no policy is configured on `HarnessConfig.workspace.policy`. */
  _internalGetWorkspacePolicy(): WorkspacePolicy | undefined {
    return this._workspacePolicy;
  }

  /** @internal — goal-loop defaults, consumed by `Session.setGoal()` (§4.7). */
  get _internalGoalDefaults(): Readonly<{ defaultJudgeModel?: string; defaultMaxTurns: number }> {
    return this._goalDefaults;
  }
}

function toThreadRecord(thread: {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}): ThreadRecord {
  return {
    id: thread.id,
    resourceId: thread.resourceId,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    metadata: stripHarnessInternalThreadMetadata(thread.metadata),
  };
}

function isMissingThreadDeleteFenceImplementation(err: unknown): boolean {
  return (
    err instanceof HarnessStorageThreadDeleteFenceUnsupportedError ||
    (err instanceof Error &&
      err.message === 'HarnessStorage.withThreadDeleteFence must be implemented by this storage adapter')
  );
}

async function waitForThreadDeleteFenceRetry(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 25));
}

function emptyPermissionRules(): PermissionRules {
  return { categories: {}, tools: {} };
}

function emptySessionGrants(): SessionGrants {
  return { categories: [], tools: [] };
}

function zeroTokenUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function sha256CanonicalJson(value: JsonValue): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function canonicalJson(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`)
    .join(',')}}`;
}
