import type { Agent } from '@mastra/core/agent';
import { Harness as HarnessLegacy } from '@mastra/core/harness';
import type { HarnessConfig, HarnessMode as HarnessModeLegacy, HarnessThread } from '@mastra/core/harness';
import type { Session, HarnessMode, Harness } from '@mastra/core/harness/v1';

type CloneSessionOptions = {
  sessionId?: string;
  threadId?: string;
  resourceId?: string;
  parentSessionId?: string;
  origin?: 'top-level' | 'subagent-tool';
  modeId?: string;
  modelId?: string;
};

type HarnessV1Session<TState = {}> = Session<TState>;
type SessionStateFields = {
  currentModelId?: string;
  modeId?: string;
};

export function v1ModeToLegacy<TState = {}>(mode: HarnessMode, agent: Agent): HarnessModeLegacy<TState> {
  const meta = mode.metadata ?? {};
  return {
    id: mode.id,
    name: mode.description,
    default: meta.default === true,
    defaultModelId: mode.defaultModelId,
    color: typeof meta.color === 'string' ? meta.color : undefined,
    agent,
  };
}

export class HarnessCompat<TState = {}> extends HarnessLegacy<TState> {
  #session?: Session<TState>;
  #harnessV1: Harness<HarnessMode[], TState>;

  constructor(args: HarnessConfig<TState>, harnessV1: Harness<HarnessMode[], TState>) {
    super(args);

    this.#harnessV1 = harnessV1;
  }

  async init(): Promise<void> {
    await super.init();
    await this.#harnessV1.init();
  }

  getState(): Readonly<TState> {
    const state = super.getState() as Readonly<TState> & SessionStateFields;
    let session: Session<TState> | undefined;
    try {
      session = this.#session;
    } catch {
      session = undefined;
    }

    if (!session) {
      return state;
    }

    // Legacy state stays the single state owner for now: session state is a
    // durability mirror only. Spreading `session.getState()` here would let
    // schema defaults (e.g. `tasks: []`) shadow legacy values written through
    // the legacy-private `updateState` path (the #17541 task-drift bug). The
    // session owns only its identity fields: model and mode.
    return {
      ...state,
      currentModelId: session.getModelId(),
      modeId: session.getMode().id,
    } as Readonly<TState>;
  }

  async setState(updates: Partial<TState>): Promise<void> {
    const { currentModelId, modeId, ...harnessUpdates } = updates as Partial<TState> & SessionStateFields;
    let session: Session<TState> | undefined;
    try {
      session = this.#session;
    } catch {
      session = undefined;
    }

    if (session) {
      if (typeof currentModelId === 'string') {
        session.setModelId(currentModelId);
      }
      if (typeof modeId === 'string' && modeId !== session.getMode().id) {
        await this.switchMode({ modeId });
      }
    }

    if (Object.keys(harnessUpdates).length > 0) {
      if (session) {
        // Mirror into the v1 session off the critical path. Legacy state is
        // still the single owner in this step; awaiting the session write here
        // adds latency on hot paths (e.g. the thread_changed handler) and
        // reorders TUI render races. Session.setState serializes internally,
        // so ordering between mirror writes is preserved.
        void session.setState(harnessUpdates as Partial<TState>).catch(() => {
          // Best-effort mirror: legacy state is authoritative in this step, so
          // a failed session write must not break the user-facing operation.
        });
      }
      await super.setState(harnessUpdates as Partial<TState>);
    }
  }

  getSubagentModelId({ agentType }: { agentType?: string } = {}): string | null {
    return super.getSubagentModelId({ agentType });
  }

  async setSubagentModelId({ modelId, agentType }: { modelId: string; agentType?: string }): Promise<void> {
    await super.setSubagentModelId({ modelId, agentType });
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    const currentModelId = (this.getState() as SessionStateFields).currentModelId;

    const session = await this.#harnessV1.session({
      threadId,
      resourceId: this.getResourceId(),
    });
    this.#session = session;

    if (typeof currentModelId === 'string' && currentModelId.length > 0) {
      session.setModelId(currentModelId);
    }

    await super.switchThread({ threadId });
  }

  async createThread({ title }: { title?: string } = {}): Promise<HarnessThread> {
    const thread = await super.createThread({ title });
    await this.#attachSession({ threadId: thread.id, resourceId: thread.resourceId });
    return thread;
  }

  async selectOrCreateThread(): Promise<HarnessThread> {
    const thread = await super.selectOrCreateThread();
    await this.#attachSession({ threadId: thread.id, resourceId: thread.resourceId });
    return thread;
  }

  /**
   * Bind the active v1 session to a thread. Idempotent — re-attaching the
   * current thread/resource pair is a no-op so `selectOrCreateThread()`
   * (which may route through the `createThread` override internally) only
   * resolves the session once. Carries the currently selected model onto the
   * session (#17558) and snapshots the current mode for fresh session records.
   */
  async #attachSession({ threadId, resourceId }: { threadId: string; resourceId?: string }): Promise<void> {
    const targetResourceId = resourceId ?? this.getResourceId();
    if (this.#session && this.#session.threadId === threadId && this.#session.resourceId === targetResourceId) {
      return;
    }

    const currentModelId = (this.getState() as SessionStateFields).currentModelId;
    const session = await this.#harnessV1.session({
      threadId,
      resourceId: targetResourceId,
      modeId: this.getCurrentModeId(),
    });
    this.#session = session;

    if (typeof currentModelId === 'string' && currentModelId.length > 0) {
      session.setModelId(currentModelId);
    }
  }

  async listThreads(options?: { allResources?: boolean; includeForkedSubagents?: boolean }): Promise<HarnessThread[]> {
    const [sessions, legacyThreads] = await Promise.all([this.#harnessV1.listSessions(), super.listThreads(options)]);
    const resourceId = this.getResourceId();

    const sessionThreads = sessions
      .filter(session => options?.allResources || session.resourceId === resourceId)
      .map((session): HarnessThread | undefined => {
        const legacyThread = legacyThreads.find(
          thread => thread.id === session.threadId && (!thread.resourceId || thread.resourceId === session.resourceId),
        );
        const metadata = legacyThread?.metadata as Record<string, unknown> | undefined;
        if (!options?.includeForkedSubagents && metadata?.forkedSubagent === true) {
          return undefined;
        }

        return {
          id: session.threadId,
          resourceId: session.resourceId,
          title: legacyThread?.title,
          createdAt: session.createdAt,
          updatedAt: session.lastActivityAt,
          metadata: {
            ...metadata,
            sessionId: session.id,
            modeId: session.modeId,
            modelId: session.modelId,
            parentSessionId: session.parentSessionId,
            origin: session.origin,
          },
        };
      })
      .filter((thread): thread is HarnessThread => thread !== undefined);

    const sessionKeys = new Set(sessionThreads.map(thread => `${thread.resourceId}:${thread.id}`));
    const sessionThreadIds = new Set(sessionThreads.map(thread => thread.id));
    return [
      ...sessionThreads,
      ...legacyThreads.filter(
        thread =>
          !sessionKeys.has(`${thread.resourceId}:${thread.id}`) &&
          !(!thread.resourceId && sessionThreadIds.has(thread.id)),
      ),
    ];
  }

  async cloneSession(opts: CloneSessionOptions = {}): Promise<Session<TState>> {
    const session = this.#session as HarnessV1Session<TState> | undefined;
    if (!session) {
      throw new Error('No active session to clone');
    }

    return this.#harnessV1.cloneSession(session, opts);
  }

  async cloneThread({
    sourceThreadId,
    title,
    resourceId,
  }: {
    sourceThreadId?: string;
    title?: string;
    resourceId?: string;
  } = {}): Promise<HarnessThread> {
    const sourceId = sourceThreadId ?? this.getCurrentThreadId();
    if (!sourceId) {
      throw new Error('No source thread to clone');
    }

    const sourceResourceId = resourceId ?? this.getResourceId();
    const currentSession = this.#session as HarnessV1Session<TState> | undefined;
    const sourceSession: HarnessV1Session<TState> =
      currentSession?.threadId === sourceId && currentSession.resourceId === sourceResourceId
        ? currentSession
        : await this.#harnessV1.session({
            threadId: sourceId,
            resourceId: sourceResourceId,
          });

    this.#session = await this.#harnessV1.cloneSession(sourceSession, { title });

    const thread = await this.#session.getThread();
    if (!thread) {
      throw new Error('Failed to load cloned thread');
    }

    return {
      id: thread.id,
      resourceId: thread.resourceId,
      title: title ?? thread.title ?? 'Cloned Thread',
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      metadata: thread.metadata,
    };
  }

  getCurrentMode(): HarnessModeLegacy<TState> {
    if (!this.#session) {
      return super.getCurrentMode();
    }

    const mode = this.#session.getMode();
    const mastra = this.getMastra();
    if (!mastra) {
      throw new Error('HarnessCompat requires an initialized Mastra instance');
    }

    // Harness v1 modes no longer carry an `agentId` field (#17534); MastraCode
    // stores the backing agent id in mode metadata instead.
    const agentId = mode.metadata?.agentId;
    if (typeof agentId !== 'string') {
      return super.getCurrentMode();
    }

    return v1ModeToLegacy(mode, mastra.getAgentById(agentId));
  }

  /**
   * Switch to a different mode.
   * Aborts any in-progress generation and switches to the mode's default model.
   */
  async switchMode({ modeId }: { modeId: string }): Promise<void> {
    const mode = this.#harnessV1.getMode(modeId);
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    // Fall back to legacy-only switching when no session is attached yet
    // (e.g. mode switch before the first thread is selected) — see #17511.
    if (this.#session) {
      this.#session.setMode(mode);
    }

    await super.switchMode({ modeId });
  }

  /**
   * Activate a skill on the current v1 session.
   *
   * Pass-through to `Session.useSkill` — returns the resolved instructions
   * string, or throws `HarnessSkillNotFoundError` if the skill is missing.
   * Throws if there is no active session.
   */
  async useSkill(name: string, _opts?: { args?: Record<string, unknown> }): Promise<string> {
    if (!this.#session) {
      throw new Error('No active session to use skill');
    }
    return this.#session.useSkill(name);
  }
}
