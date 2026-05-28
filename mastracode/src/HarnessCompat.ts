import { Harness as HarnessLegacy } from '@mastra/core/harness';
import type { HarnessMode as HarnessModeLegacy, HarnessThread } from '@mastra/core/harness';
import type { Session, HarnessMode } from '@mastra/core/harness/v1';
import { Harness } from '@mastra/core/harness/v1';

type CloneSessionOptions = {
  sessionId?: string;
  threadId?: string;
  resourceId?: string;
  parentSessionId?: string;
  origin?: 'top-level' | 'subagent-tool';
  modeId?: string;
  modelId?: string;
};

type HarnessV1Session = Session & {
  id: string;
  resourceId: string;
  threadId: string;
  clone(opts?: CloneSessionOptions): Promise<Session>;
};

type HarnessSessionRecord = {
  id: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  origin: 'top-level' | 'subagent-tool';
  modeId: string;
  modelId: string;
};

export class HarnessCompat<TState = {}> extends HarnessLegacy<TState> {
  #session!: Session;
  #harnessV1?: Harness<HarnessMode[]>;

  async #getHarnessV1() {
    if (!this.#harnessV1) {
      const mastra = this.getMastra();
      if (!mastra) {
        throw new Error('HarnessCompat requires an initialized Mastra instance');
      }

      const modes = this.listModes();
      const defaultModeId = modes.find(mode => mode.default)!.id;
      const memory = await this.getResolvedMemory();
      if (!memory) {
        throw new Error('HarnessCompat requires memory for Harness v1');
      }

      this.#harnessV1 = new Harness({
        mastra,
        memory,
        modes: modes.map((mode): HarnessMode => {
          const agent = typeof mode.agent === 'function' ? mode.agent(this.getState() as TState) : mode.agent;

          return {
            id: mode.id,
            agentId: (agent as { id: string }).id,
            metadata: {
              color: mode.color,
            },
          };
        }),
        defaultModeId,
      } as any);
    }

    return this.#harnessV1;
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    const modes = this.listModes();
    const harnessV1 = await this.#getHarnessV1();

    this.#session = await harnessV1.session({
      threadId,
      resourceId: this.getResourceId(),
    });

    const defaultModelId = modes.find(mode => mode.id === this.#session.getMode().id)?.defaultModelId;
    if (defaultModelId) {
      this.#session.setModelId(defaultModelId);
    }

    await super.switchThread({ threadId });
  }

  async listThreads(_options?: { allResources?: boolean; includeForkedSubagents?: boolean }): Promise<HarnessThread[]> {
    const harnessV1 = (await this.#getHarnessV1()) as Harness<HarnessMode[]> & {
      listSessions(): Promise<HarnessSessionRecord[]>;
    };
    const sessions = await harnessV1.listSessions();

    if (!sessions.length) {
      return super.listThreads(_options);
    }

    return sessions.map(session => ({
      id: session.threadId,
      resourceId: session.resourceId,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      metadata: {
        sessionId: session.id,
        modeId: session.modeId,
        modelId: session.modelId,
        parentSessionId: session.parentSessionId,
        origin: session.origin,
      },
    }));
  }

  async cloneSession(opts: CloneSessionOptions = {}): Promise<Session> {
    const session = this.#session as HarnessV1Session | undefined;
    if (!session) {
      throw new Error('No active session to clone');
    }

    return session.clone(opts);
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
        : ((await (
            await this.#getHarnessV1()
          ).session({
            threadId: sourceId,
            resourceId: sourceResourceId,
          })) as HarnessV1Session);

    this.#session = await sourceSession.clone();

    return (await this.#session.getThread())!;
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

    return {
      id: mode.id,
      agent: mastra.getAgentById(mode.agentId),
      color: typeof mode.metadata?.color === 'string' ? mode.metadata.color : undefined,
      default: false,
      defaultModelId: this.#session.getModelId(),
    };
  }

  /**
   * Switch to a different mode.
   * Aborts any in-progress generation and switches to the mode's default model.
   */
  async switchMode({ modeId }: { modeId: string }): Promise<void> {
    const harnessV1 = await this.#getHarnessV1();

    const mode = harnessV1.getMode(modeId);
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    this.#session.setMode(mode);

    await super.switchMode({ modeId });
  }
}
