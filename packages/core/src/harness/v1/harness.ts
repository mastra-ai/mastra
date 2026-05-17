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
 * remote SDKs, durable admission/result rows, channels, wakeups, and worker
 * recovery live in follow-up Harness v1 lanes.
 */

import { randomUUID } from 'node:crypto';

import type { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import type {
  HarnessStorage,
  PermissionRules,
  SessionGrants,
  SessionRecord,
  SessionSummary,
  TokenUsage,
} from '../../storage/domains/harness';
import {
  HarnessStorageAttachmentInUseError,
  HarnessStorageLeaseConflictError,
  HarnessStorageParentSessionUnavailableError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageThreadDeleteFenceUnsupportedError,
  HarnessStorageVersionConflictError,
} from '../../storage/domains/harness';
import type { MemoryStorage } from '../../storage/domains/memory/base';

import { InMemoryStore } from '../../storage/mock';
import type { Workspace } from '../../workspace';

import {
  HarnessAttachmentInUseError,
  HarnessConfigError,
  HarnessModelNotFoundError,
  HarnessSessionClosedError,
  HarnessSessionClosingError,
  HarnessSessionDeleteBlockedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessStorageError,
  HarnessThreadNotFoundError,
  HarnessWorkspaceProviderMismatchError,
} from './errors';
import { EventEmitter } from './events';
import type { HarnessEvent, HarnessEventListener, HarnessEventUnsubscribe } from './events';
import { Session } from './session';
import type {
  AttachmentDeleteOptions,
  AttachmentRef,
  AttachmentUploadOptions,
  HarnessConfig,
  HarnessMode,
  HarnessSkill,
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
import { WorkspaceRegistry } from './workspace-registry';

const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_MAX_QUEUE_DEPTH = 100;
const DEFAULT_CLOSE_TIMEOUT_MS = 30_000;
const MAX_CLOSE_TIMEOUT_MS = 2_147_483_647;
const DEFAULT_SUBAGENT_MAX_DEPTH = 1;
const DEFAULT_GOAL_MAX_TURNS = 50;
const DEFAULT_PERMISSION_POLICY: PermissionPolicy = 'ask';

type CloseTreeNode = {
  record: SessionRecord;
  depth: number;
  live?: Session;
  leaseAcquired: boolean;
};

function cloneHarnessSkill(skill: HarnessSkill): HarnessSkill {
  return {
    ...skill,
    ...(skill.metadata ? { metadata: cloneSkillMetadata(skill.metadata, new WeakMap()) } : {}),
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

export class Harness {
  /** Process-scoped owner id used as the lease holder for all sessions. */
  readonly ownerId: string;

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
  private readonly _storageOverride?: HarnessStorage;
  private readonly _modesById: Map<string, HarnessMode>;
  private readonly _defaultModeId?: string;
  private readonly _liveSessions = new Map<string, Session>();
  private readonly _leaseTtlMs: number;
  private readonly _maxQueueDepth: number;
  private readonly _closeTimeoutMs: number;
  private readonly _subagentTypes: ReadonlyMap<string, SubagentDefinition>;
  private readonly _subagentMaxDepth: number;
  private readonly _goalDefaults: { defaultJudgeModel?: string; defaultMaxTurns: number };
  private readonly _defaultPermissionPolicy: PermissionPolicy;
  private readonly _toolCategoryResolver?: (toolName: string) => ToolCategory | null;
  private readonly _modelCatalog: ReadonlyMap<string, ModelInfo>;
  private readonly _modelAuthStatusResolver?: (modelId: string) => ModelAuthStatus | Promise<ModelAuthStatus>;
  private readonly _codeSkills: ReadonlyMap<string, HarnessSkill>;
  private readonly _emitter = new EventEmitter();
  /** Per-session unsubscribers so harness-level subscribers see session events too. */
  private readonly _sessionEventBridges = new Map<string, HarnessEventUnsubscribe>();
  /** In-process close de-dupe by any session id currently covered by a close tree. */
  private readonly _closePromises = new Map<string, Promise<void>>();
  /** Workspace registry — owns lifecycle across `shared`/`per-resource`/`per-session`. */
  readonly _workspaceRegistry: WorkspaceRegistry;
  /** Snapshot of the workspace kind for fast read paths. `undefined` when not configured. */
  readonly _workspaceKind?: 'shared' | 'per-resource' | 'per-session';

  private _shutdown = false;

  constructor(config: HarnessConfig) {
    this.ownerId = `harness-${randomUUID()}`;
    this._leaseTtlMs = DEFAULT_LEASE_TTL_MS;
    this._storageOverride = config.sessions?.storage;
    this._maxQueueDepth = config.sessions?.maxQueueDepth ?? DEFAULT_MAX_QUEUE_DEPTH;
    if (this._maxQueueDepth < 1) {
      throw new HarnessConfigError('sessions.maxQueueDepth', 'must be a positive integer');
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

    // Workspace (§2.7). Three ownership models; registry handles lifecycle.
    // Cross-checks against the subagent registry happen below.
    this._workspaceKind = config.workspace?.kind;
    this._workspaceRegistry = new WorkspaceRegistry({
      config: config.workspace,
      emitter: this._emitter,
    });

    // Eager provisioning for `kind: 'shared'`. Per-resource and per-session
    // are eagerly provisioned at session creation when `eager: true`
    // (handled in Session._resolve / Session._construct).
    if (config.workspace?.kind === 'shared' && config.workspace.eager) {
      void this._workspaceRegistry.acquireShared().catch(() => {
        // Errors surface through the workspace_error event; swallow here.
      });
    }

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
   * @internal — called by `Mastra` during its own construction when this
   * harness is registered under `harnesses.<name>`. Idempotent for the
   * same parent; throws if called twice with different parents.
   */
  __registerMastra(mastra: Mastra, harnessName?: string): void {
    if (this._mastra && this._mastra !== mastra) {
      throw new HarnessConfigError('mastra', 'harness is already bound to a different Mastra instance');
    }
    if (this._mastra === mastra) {
      if (harnessName !== undefined && harnessName !== this._harnessName) {
        throw new HarnessConfigError('mastra', 'harness is already registered under a different harness name');
      }
      return;
    }
    if (harnessName !== undefined) {
      this._harnessName = harnessName;
    }
    this._bindMastra(mastra);
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
    this._trackMemoryStorage(mastra.getStorage()?.stores?.memory);
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
    return this.mastra.getAgent(mode.agentId as never) as Agent;
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
      return this._resolveById(storage, opts.sessionId, opts.resourceId);
    }

    // 2) threadId resolution. May be `{ fresh: true }` to force a new thread.
    if ('threadId' in opts && opts.threadId !== undefined) {
      return this._resolveByThread(storage, opts);
    }

    // 3) resourceId-only resolution: most-recent active or create.
    if ('resourceId' in opts && opts.resourceId) {
      return this._resolveByResource(storage, opts);
    }

    throw new HarnessConfigError('session()', 'invalid resolver options');
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

  private async _hydrate(storage: HarnessStorage, stored: SessionRecord): Promise<Session> {
    const lease = await this._acquireLease(storage, stored.id);
    const record: SessionRecord = {
      ...stored,
      ownerId: this.ownerId,
      leaseExpiresAt: lease.expiresAt,
      version: lease.version,
    };
    return this._publish(storage, record);
  }

  private _publish(storage: HarnessStorage, record: SessionRecord): Session {
    return this._adoptSession(storage, record, { emitCreated: true, kickQueueDrain: true });
  }

  private _adoptSession(
    storage: HarnessStorage,
    record: SessionRecord,
    opts: { emitCreated: boolean; kickQueueDrain: boolean },
  ): Session {
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
    });
    if (workspaceLost) session._markWorkspaceLost();
    this._liveSessions.set(record.id, session);

    // Bridge the session's events onto the harness-level emitter so a single
    // harness.subscribe() sees every session's turn activity. Forwarded
    // events keep their original id/timestamp/sessionId.
    const bridge = session._subscribeInternal(event => this._emitter.forward(event));
    this._sessionEventBridges.set(record.id, bridge);

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

  private async _acquireLease(storage: HarnessStorage, sessionId: string) {
    try {
      return await storage.acquireSessionLease({
        harnessName: this._harnessName,
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
  async closeSession(opts: { sessionId: string }): Promise<void> {
    if (this._shutdown) return;
    const storage = this._requireStorage('closeSession()');
    const live = this._liveSessions.get(opts.sessionId);
    if (live) {
      await this._closeSession(live);
      return;
    }
    const stored = await storage.loadSession({ harnessName: this._harnessName, sessionId: opts.sessionId });
    if (!stored) throw new HarnessSessionNotFoundError(opts.sessionId);
    if (stored.closedAt !== undefined) return; // already closed → idempotent.
    await this._closeSessionRecord(storage, stored);
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
  ): Promise<void> {
    const tree: CloseTreeNode[] = [];
    try {
      const root = await this._prepareCloseNode(storage, rootRecord, 0);
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
          const childNode = await this._prepareCloseNode(storage, stored, node.depth + 1);
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
  ): Promise<CloseTreeNode> {
    const live = this._liveSessions.get(record.id);
    if (live) {
      return {
        record: live.getRecord(),
        depth,
        live,
        leaseAcquired: false,
      };
    }

    const lease = await this._acquireLease(storage, record.id);
    const leasedRecord = {
      ...record,
      ownerId: this.ownerId,
      leaseExpiresAt: lease.expiresAt,
      version: lease.version,
    };
    if ((leasedRecord.pendingQueue?.length ?? 0) > 0) {
      const recovered = this._adoptSession(storage, leasedRecord, { emitCreated: false, kickQueueDrain: false });
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
      // Best-effort — registry surfaces errors via workspace_error events.
    }

    if (session) {
      closedLiveSessions?.set(record.id, session);
      session._markClosed(record);
      // Emit session_closed BEFORE we tear down the per-session bridge so
      // harness-level subscribers see the lifecycle event for this session.
      // The session's own emitter is still wired and will publish to the
      // bridge before the unsubscribe lands.
      session._emit({ type: 'session_closed', reason: 'requested' });
    } else {
      this._emitter.emit({ type: 'session_closed', reason: 'requested' }, { sessionId: record.id });
    }

    const bridge = this._sessionEventBridges.get(record.id);
    if (bridge) {
      bridge();
      this._sessionEventBridges.delete(record.id);
    }
    this._liveSessions.delete(record.id);
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
      await this._closeSessionRecord(storage, latest, liveDeleteHandles);
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
    await storage.deleteSessions({
      sessions: bottomUp.map(node => ({
        harnessName: node.record.harnessName,
        sessionId: node.record.id,
        ifVersion: node.record.version,
        expectedResourceId: node.record.resourceId,
        expectedThreadId: node.record.threadId,
        expectedParentSessionId: node.record.parentSessionId ?? null,
        expectedCreatedAt: node.record.createdAt,
        requireClosed: true,
      })),
    });
    for (const node of bottomUp) {
      const live = this._liveSessions.get(node.record.id) ?? deletedLiveSessions.get(node.record.id);
      live?._markDeleted();
      const bridge = this._sessionEventBridges.get(node.record.id);
      if (bridge) {
        bridge();
        this._sessionEventBridges.delete(node.record.id);
      }
      this._liveSessions.delete(node.record.id);
    }
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

  /**
   * Drain in-flight work and release every held lease. After `shutdown`,
   * `session()` rejects. Idempotent.
   */
  async shutdown(_opts?: ShutdownOptions): Promise<void> {
    if (this._shutdown) return;
    this._shutdown = true;

    let storage: HarnessStorage;
    try {
      storage = this._requireStorage('shutdown()');
    } catch {
      // No storage bound — nothing to release. Idempotent.
      this._liveSessions.clear();
      this._untrackBoundStorage();
      return;
    }

    const pendingCloses = new Set(this._closePromises.values());
    if (pendingCloses.size > 0) {
      await Promise.allSettled(pendingCloses);
    }

    // Release every held lease. We keep the records active in storage —
    // shutdown is not a close.
    const sessions = Array.from(this._liveSessions.values());
    for (const session of sessions) {
      try {
        await storage.releaseSessionLease({
          harnessName: session.getRecord().harnessName,
          sessionId: session.id,
          ownerId: this.ownerId,
        });
      } catch {
        // Best-effort: leases TTL out anyway.
      }

      // Surface eviction to harness-level subscribers BEFORE we tear down
      // the bridge so the event still propagates.
      session._emit({ type: 'session_evicted', reason: 'shutdown' });

      const bridge = this._sessionEventBridges.get(session.id);
      if (bridge) {
        bridge();
        this._sessionEventBridges.delete(session.id);
      }
    }
    this._liveSessions.clear();

    // Tear down every provisioned workspace (shared + per-resource + per-session).
    try {
      await this._workspaceRegistry.shutdown();
    } catch {
      // Best-effort: errors surface through the workspace_error event.
    }
    this._untrackBoundStorage();
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

  attachments = {
    upload: async (opts: AttachmentUploadOptions): Promise<AttachmentRef> => {
      const storage = this._requireStorage('attachments.upload()');
      const session = await this.session(
        opts.resourceId ? { sessionId: opts.sessionId, resourceId: opts.resourceId } : { sessionId: opts.sessionId },
      );
      const data =
        opts.data instanceof Uint8Array
          ? new Uint8Array(opts.data)
          : new Uint8Array(await new Response(opts.data).arrayBuffer());
      const attachmentId = `attachment-${randomUUID()}`;
      const saved = await storage.saveAttachment({
        harnessName: session.getRecord().harnessName,
        sessionId: session.id,
        attachmentId,
        name: opts.filename,
        mimeType: opts.contentType,
        source: 'preupload',
        data,
      });
      return {
        attachmentId: saved.attachmentId,
        resourceId: session.resourceId,
        ownerSessionId: session.id,
        bytes: saved.bytes,
        sha256: saved.sha256,
        source: 'preupload',
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

  /** @internal — exposed for inspection in tests. */
  _internalLiveSessionCount(): number {
    return this._liveSessions.size;
  }

  /** @internal — accessor for `Session.queue()` admission caps. */
  get _internalMaxQueueDepth(): number {
    return this._maxQueueDepth;
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
