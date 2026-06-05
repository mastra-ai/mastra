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

type HarnessV1Session = Session;

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
  #session!: Session;
  #harnessV1: Harness<HarnessMode[]>;

  constructor(args: HarnessConfig<TState>, harnessV1: Harness<HarnessMode[]>) {
    super(args);

    this.#harnessV1 = harnessV1;
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    const modes = this.listModes();

    this.#session = await this.#harnessV1.session({
      threadId,
      resourceId: this.getResourceId(),
    });

    const defaultModelId = modes.find(mode => mode.id === this.#session.getMode().id)?.defaultModelId;
    if (defaultModelId) {
      this.#session.setModelId(defaultModelId);
    }

    await super.switchThread({ threadId });
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

  async cloneSession(opts: CloneSessionOptions = {}): Promise<Session> {
    const session = this.#session as HarnessV1Session | undefined;
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
    const currentSession = this.#session as HarnessV1Session | undefined;
    const sourceSession: HarnessV1Session =
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

    return v1ModeToLegacy(mode, mastra.getAgentById(mode.agentId));
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

    if (this.#session) {
      this.#session.setMode(mode);
    }

    await super.switchMode({ modeId });
  }
}
