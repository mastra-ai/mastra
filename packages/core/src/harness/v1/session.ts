import { randomUUID } from 'node:crypto';

import { RequestContext } from '@internal/core/request-context';
import type { ToolsInput } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraMemory, StorageThreadType } from '../../memory';
import { toStandardSchema } from '../../schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../../schema';
import type { DynamicArgument } from '../../types';
import type { Workspace } from '../../workspace';
import type { Skill, SkillMetadata } from '../../workspace/skills/types';
import type { EventEmitter } from './events';
import type { HarnessMode } from './mode';
import type { PermissionPolicy, ToolCategoryResolver } from './permissions.types';
import type { CloneSessionOptions, SessionConfig } from './session.types';
import { HarnessSkillNotFoundError } from './skills.types';
import type { SkillSource } from './skills.types';
import type { ModelResolver, SubagentRegistryConfig } from './subagents.types';

export class Session<TState = {}> {
  /** Stable identity. Frozen at construction. */
  readonly #id: string;
  readonly #ownerId: string;
  readonly #resourceId: string;
  readonly #threadId: string;
  readonly #createdAt: Date;
  readonly #lastActivityAt: Date;
  readonly #memory: MastraMemory | DynamicArgument<MastraMemory>;
  readonly #events: EventEmitter;
  readonly #stateSchemaInput?: PublicSchema<TState>;
  readonly #stateSchema?: StandardSchemaWithJSON<TState>;
  #state: TState;
  #stateUpdateQueue: Promise<void> = Promise.resolve();
  readonly #workspace?: DynamicArgument<Workspace | undefined>;
  #resolvedWorkspace?: Workspace;
  #workspaceResolved = false;
  readonly #skills: readonly Skill[];
  /**
   * Single-flight cache for workspace skill discovery (spec §4.6: concurrent
   * `listSkills`/`useSkill` calls must share the same in-flight promise so we
   * don't re-scan the workspace per call).
   */
  #workspaceSkillsPromise?: Promise<SkillMetadata[]>;
  readonly #subagents?: SubagentRegistryConfig;
  readonly #resolveModel?: ModelResolver;
  readonly #defaultPermissionPolicy: PermissionPolicy;
  readonly #toolCategoryResolver?: ToolCategoryResolver;
  // readonly parentSessionId?: string;
  // readonly subagentDepth: number;

  #modelId: string;
  #mode: HarnessMode;

  constructor(config: SessionConfig<TState>) {
    this.#id = config.id;
    this.#ownerId = config.ownerId;
    this.#resourceId = config.resourceId;
    this.#threadId = config.threadId;
    this.#mode = config.mode;
    this.#modelId = config.model;
    this.#createdAt = config.createdAt;
    this.#lastActivityAt = config.lastActivityAt;
    this.#memory = config.memory;
    this.#events = config.events;
    this.#stateSchemaInput = config.stateSchema;
    this.#stateSchema = config.stateSchema ? toStandardSchema(config.stateSchema) : undefined;
    this.#state = {
      ...this.#getSchemaDefaults(),
      ...config.initialState,
    } as TState;
    this.#workspace = config.workspace;
    this.#skills = config.skills ?? [];
    this.#subagents = config.subagents;
    this.#resolveModel = config.resolveModel;
    this.#defaultPermissionPolicy = config.defaultPermissionPolicy ?? 'ask';
    this.#toolCategoryResolver = config.toolCategoryResolver;
  }

  get id(): string {
    return this.#id;
  }

  get ownerId(): string {
    return this.#ownerId;
  }

  get resourceId(): string {
    return this.#resourceId;
  }

  get threadId(): string {
    return this.#threadId;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  async clone(opts: CloneSessionOptions = {}): Promise<Session<TState>> {
    const result = await (
      await this.#resolveMemory()
    ).cloneThread({
      sourceThreadId: this.#threadId,
      newThreadId: opts.threadId,
      resourceId: opts.resourceId ?? this.#resourceId,
      title: opts.title,
      metadata: opts.metadata,
      options: opts.messageLimit !== undefined ? { messageLimit: opts.messageLimit } : undefined,
    });

    const cloneId = opts.sessionId ?? randomUUID();
    const clone = new Session<TState>({
      id: cloneId,
      ownerId: this.#ownerId,
      threadId: result.thread.id,
      resourceId: result.thread.resourceId,
      mode: opts.mode ?? this.#mode,
      model: opts.modelId ?? this.#modelId,
      createdAt: result.thread.createdAt,
      lastActivityAt: result.thread.updatedAt,
      memory: this.#memory,
      events: this.#events.scoped({ sessionId: cloneId }),
      stateSchema: this.#stateSchemaInput,
      initialState: this.getState() as Partial<TState>,
      workspace: this.#workspace,
      skills: this.#skills,
      subagents: this.#subagents,
      resolveModel: this.#resolveModel,
      defaultPermissionPolicy: this.#defaultPermissionPolicy,
      toolCategoryResolver: this.#toolCategoryResolver,
    });

    this.#events.emit({
      type: 'thread_cloned',
      threadId: clone.threadId,
      resourceId: clone.resourceId,
      sourceThreadId: this.#threadId,
      title: opts.title,
    });

    return clone;
  }

  async getThread(): Promise<StorageThreadType | null> {
    return (await this.#resolveMemory()).getThreadById({ threadId: this.#threadId });
  }

  async getMessages(): Promise<MastraDBMessage[]> {
    const result = await (
      await this.#resolveMemory()
    ).recall({ threadId: this.#threadId, resourceId: this.#resourceId });
    return result.messages;
  }

  async saveMessages(
    messages: MastraDBMessage[],
  ): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
    return (await this.#resolveMemory()).saveMessages({ messages });
  }

  getState(): Readonly<TState> {
    return Object.freeze({ ...(this.#state as Record<string, unknown>) }) as Readonly<TState>;
  }

  async setState(updates: Partial<TState>): Promise<void> {
    const run = this.#stateUpdateQueue.then(() => this.#applyStateUpdates(updates));
    this.#stateUpdateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async updateState<TResult>(
    updater: (
      state: Readonly<TState>,
    ) =>
      | { updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }
      | Promise<{ updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }>,
  ): Promise<TResult> {
    const run = this.#stateUpdateQueue.then(async () => {
      const update = await updater(this.getState());
      if (update.updates && Object.keys(update.updates).length > 0) {
        await this.#applyStateUpdates(update.updates);
      }
      for (const event of update.events ?? []) {
        this.#events.emit(event);
      }
      return update.result;
    });

    this.#stateUpdateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  getModelId(): string {
    return this.#modelId;
  }

  setModelId(modelId: string) {
    const previousModelId = this.#modelId;
    this.#modelId = modelId;
    if (modelId !== previousModelId) {
      this.#events.emit({ type: 'model_changed', modelId, previousModelId });
    }
  }

  getMode(): HarnessMode {
    return this.#mode;
  }

  /**
   * Returns the current mode's tool overrides. `tools` replaces the backing
   * agent's tools; `additionalTools` augments them. The two are mutually
   * exclusive (validated at Harness construction).
   */
  getToolOverrides(): { tools?: ToolsInput; additionalTools?: ToolsInput } {
    return { tools: this.#mode.tools, additionalTools: this.#mode.additionalTools };
  }

  setMode(mode: HarnessMode) {
    const previousModeId = this.#mode.id;
    this.#mode = mode;
    if (mode.id !== previousModeId) {
      this.#events.emit({ type: 'mode_changed', modeId: mode.id, previousModeId });
    }
  }

  /**
   * Returns the merged skill catalog as metadata entries. Explicitly configured
   * canonical skills take precedence over workspace-discovered skills on name
   * collision. Workspace discovery is async on first call and cached for the
   * lifetime of the session (use `refreshSkills` to invalidate).
   */
  async listSkills(): Promise<SkillMetadata[]> {
    const merged = new Map<string, SkillMetadata>();
    const workspaceSkills = await this.#loadWorkspaceSkillMetadata();
    for (const skill of workspaceSkills) {
      merged.set(skill.name, skill);
    }
    for (const skill of this.#skills) {
      merged.set(skill.name, skill);
    }
    return [...merged.values()];
  }

  /**
   * Look up a single skill by name. Returns `null` when no skill matches;
   * use `useSkill` when a missing skill should be a hard error.
   */
  async getSkill(name: string): Promise<Skill | null> {
    const configuredMatch = this.#skills.find(skill => skill.name === name);
    if (configuredMatch) return configuredMatch;

    const workspace = await this.#getResolvedWorkspace();
    if (!workspace?.skills) return null;

    // Use the cached metadata list before materialising a full skill so
    // configured skills keep deterministic precedence and concurrent discovery
    // stays single-flight.
    const workspaceSkills = await this.#loadWorkspaceSkillMetadata();
    if (!workspaceSkills.some(skill => skill.name === name)) return null;

    return workspace.skills.get(name);
  }

  /**
   * Activate a skill by name. Validates `opts.args` against the skill's
   * `metadata.args` schema if both are present, then returns the canonical
   * skill instructions string.
   *
   * Throws `HarnessSkillNotFoundError` when the skill cannot be resolved.
   */
  async useSkill(name: string, opts: { args?: Record<string, unknown> } = {}): Promise<string> {
    const skill = await this.getSkill(name);
    if (!skill) {
      throw new HarnessSkillNotFoundError({
        name,
        searchedSources: this.#searchedSources(),
      });
    }

    if (skill.metadata?.args && opts.args !== undefined) {
      const argsSchema = toStandardSchema(skill.metadata.args as PublicSchema);
      const result = await argsSchema['~standard'].validate(opts.args);
      if (result.issues) {
        const messages = result.issues.map((issue: { message?: string }) => issue.message).join('; ');
        throw new Error(`Invalid skill args for "${name}": ${messages}`);
      }
    }

    return skill.instructions;
  }

  /**
   * Invalidate the workspace skill discovery cache. The next `listSkills` or
   * `useSkill` call will re-query the workspace. Explicit configured skills
   * are configuration and are unaffected.
   */
  refreshSkills(): void {
    this.#workspaceSkillsPromise = undefined;
  }

  #searchedSources(): SkillSource[] {
    const sources: SkillSource[] = [];
    if (this.#skills.length > 0) sources.push('configured');
    if (this.#workspace !== undefined) sources.push('workspace');
    return sources;
  }

  async #loadWorkspaceSkillMetadata(): Promise<SkillMetadata[]> {
    if (!this.#workspaceSkillsPromise) {
      this.#workspaceSkillsPromise = this.#discoverWorkspaceSkillMetadata().catch(err => {
        // Reset on failure so a later call can retry instead of poisoning the
        // cache. Re-throw to surface the original error to the current caller.
        this.#workspaceSkillsPromise = undefined;
        throw err;
      });
    }
    return this.#workspaceSkillsPromise;
  }

  async #discoverWorkspaceSkillMetadata(): Promise<SkillMetadata[]> {
    const workspace = await this.#getResolvedWorkspace();
    if (!workspace?.skills) return [];
    return workspace.skills.list();
  }

  async #getResolvedWorkspace(requestContext?: RequestContext): Promise<Workspace | undefined> {
    const workspace = this.#workspace;
    if (!workspace) return undefined;
    if (typeof workspace !== 'function') return workspace;
    if (this.#workspaceResolved) return this.#resolvedWorkspace;

    const resolved = await workspace({ requestContext: requestContext ?? new RequestContext() });
    this.#resolvedWorkspace = resolved;
    this.#workspaceResolved = true;
    return resolved;
  }

  async #applyStateUpdates(updates: Partial<TState>): Promise<void> {
    const changedKeys = Object.keys(updates);
    const newState = { ...(this.#state as Record<string, unknown>), ...(updates as Record<string, unknown>) };

    if (this.#stateSchema) {
      const result = await this.#stateSchema['~standard'].validate(newState);
      if (result.issues) {
        const messages = result.issues.map((issue: { message?: string }) => issue.message).join('; ');
        throw new Error(`Invalid state update: ${messages}`);
      }
      this.#state = result.value as TState;
    } else {
      this.#state = newState as TState;
    }

    this.#events.emit({
      type: 'state_changed',
      state: this.#state as Record<string, unknown>,
      changedKeys,
    });
  }

  #getSchemaDefaults(): Partial<TState> {
    if (!this.#stateSchema) return {};

    const defaults: Record<string, unknown> = {};

    try {
      const jsonSchema = this.#stateSchema['~standard'].jsonSchema.output({ target: 'draft-07' }) as {
        properties?: Record<string, { default?: unknown }>;
      };
      for (const [key, prop] of Object.entries(jsonSchema.properties ?? {})) {
        if (prop.default !== undefined) {
          defaults[key] = prop.default;
        }
      }
    } catch {
      // Schema doesn't support JSON Schema extraction.
    }

    return defaults as Partial<TState>;
  }

  async #buildRequestContext(requestContext?: RequestContext): Promise<RequestContext> {
    requestContext ??= new RequestContext();
    const harnessContext = {
      sessionId: this.#id,
      getState: () => this.getState(),
      setState: (updates: Partial<TState>) => this.setState(updates),
      updateState: <TResult>(
        updater: (
          state: Readonly<TState>,
        ) =>
          | { updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }
          | Promise<{ updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }>,
      ) => this.updateState(updater),
      threadId: this.#threadId,
      resourceId: this.#resourceId,
      modeId: this.#mode.id,
      modelId: this.#modelId,
      workspace: undefined as Workspace | undefined,
      listSkills: () => this.listSkills(),
      getSkill: (name: string) => this.getSkill(name),
      useSkill: (name: string, opts?: { args?: Record<string, unknown> }) => this.useSkill(name, opts),
      refreshSkills: () => this.refreshSkills(),
    };

    requestContext.set('harness', harnessContext);
    harnessContext.workspace = await this.#getResolvedWorkspace(requestContext);

    return requestContext;
  }

  async #resolveMemory(): Promise<MastraMemory> {
    const mem = this.#memory;
    if (!mem) {
      throw new Error('Memory is not configured on this Harness');
    }
    if (typeof mem !== 'function') {
      return mem;
    }
    const requestContext = await this.#buildRequestContext();
    const resolved = await mem({ requestContext });
    if (!resolved) {
      throw new Error('Dynamic memory factory returned empty value');
    }
    return resolved;
  }
}
