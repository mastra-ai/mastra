import { isAbsolute } from 'node:path';
import { PROTOCOL_VERSION, RequestError } from '@agentclientprotocol/sdk';
import type {
  Agent,
  AgentSideConnection,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  CancelNotification,
  ContentBlock,
  SessionConfigOption,
  SetSessionConfigOptionRequest,
  SetSessionConfigOptionResponse,
  AvailableCommand,
} from '@agentclientprotocol/sdk';
import type { AgentController, AgentControllerMode, Session } from '@mastra/core/agent-controller';
import { getAvailableThinkingLevelsForModel, isThinkingLevelSetting } from '../thinking.js';
import type { ThinkingLevelSetting } from '../thinking.js';
import { getCurrentVersion } from '../utils/update-check.js';
import { handleAgentControllerEvent } from './event-mapper.js';
import type { PromptState } from './event-mapper.js';
import { expandSkillCommand, listSkillCommands } from './skills.js';
import type { AcpSkills } from './skills.js';

export interface AcpSessionRuntime {
  controller: AgentController;
  session: Session;
  modes: AgentControllerMode[];
  getThinkingLevel?: () => ThinkingLevelSetting;
  getSkills?: () => Promise<AcpSkills | undefined>;
  cleanup?: () => Promise<void>;
}

export type AcpSessionFactory = (request: NewSessionRequest) => Promise<AcpSessionRuntime>;

interface SessionEntry extends AcpSessionRuntime {
  models: { modelId: string; name: string }[];
  state: PromptState | null;
  queue: Promise<void>;
  turns: Set<{ cancelled: boolean }>;
  unsubscribe: () => void;
  commands?: AvailableCommand[];
}

/** One ACP connection, with an independent Mastra Code runtime for each conversation. */
export class MastraCodeAcpAgent implements Agent {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly pendingCreations = new Set<Promise<NewSessionResponse>>();
  private readonly startupCleanupFailures: unknown[] = [];
  private disposed = false;
  private disposal?: Promise<void>;

  constructor(
    private readonly connection: AgentSideConnection,
    private readonly createSession: AcpSessionFactory,
  ) {}

  private getSession(sessionId: string): SessionEntry {
    const entry = this.sessions.get(sessionId);
    if (!entry || this.disposed) throw RequestError.invalidParams({ sessionId }, 'Unknown ACP session');
    return entry;
  }

  private enqueue<T>(entry: SessionEntry, operation: () => Promise<T>): Promise<T> {
    const result = entry.queue.then(operation);
    entry.queue = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    const entries = [...this.sessions.values()];
    this.sessions.clear();
    this.disposal = Promise.allSettled([
      // A runtime under construction owns its cleanup until it joins sessions.
      Promise.allSettled([...this.pendingCreations]),
      ...entries.map(async entry => {
        for (const turn of entry.turns) turn.cancelled = true;
        if (entry.state) {
          entry.state.cancelled = true;
          entry.session.abort();
          entry.state?.resolve('aborted');
        }
        entry.unsubscribe();
        await entry.cleanup?.();
      }),
    ]).then(results => {
      const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
      failures.push(...this.startupCleanupFailures);
      if (failures.length) throw new AggregateError(failures, 'ACP session cleanup failed');
    });
    return this.disposal;
  }

  async initialize(_request: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: { name: 'mastracode', title: 'Mastra Code', version: getCurrentVersion() },
      agentCapabilities: { loadSession: false, mcpCapabilities: { http: true, sse: true } },
    };
  }

  async authenticate(): Promise<void> {
    throw RequestError.invalidParams(undefined, 'Configure authentication through Mastra Code before starting ACP');
  }

  newSession(request: NewSessionRequest): Promise<NewSessionResponse> {
    const creating = Promise.resolve().then(() => this.createNewSession(request));
    this.pendingCreations.add(creating);
    void creating.then(
      () => this.pendingCreations.delete(creating),
      () => this.pendingCreations.delete(creating),
    );
    return creating;
  }

  private async createNewSession(request: NewSessionRequest): Promise<NewSessionResponse> {
    if (this.disposed) throw RequestError.internalError(undefined, 'ACP connection is closed');
    if (!isAbsolute(request.cwd)) throw RequestError.invalidParams(undefined, 'cwd must be an absolute path');
    const runtime = await this.createSession(request);
    try {
      if (this.disposed) throw RequestError.internalError(undefined, 'ACP connection is closed');
      const thread = await runtime.session.thread.create();
      await runtime.session.thread.switch({ threadId: thread.id });
      let models: NewSessionResponse['models'];
      try {
        const available = await runtime.controller.listAvailableModels();
        models = {
          currentModelId: runtime.session.model.get() ?? '',
          availableModels: includeCurrentModel(
            [
              ...new Map(
                available
                  .filter(model => model.hasApiKey || model.id === runtime.session.model.get())
                  .map(
                    model =>
                      [
                        model.id,
                        {
                          modelId: model.id,
                          name: model.hasApiKey ? model.id : `${model.id} (provider not configured)`,
                        },
                      ] as const,
                  ),
              ).values(),
            ],
            runtime.session.model.get() ?? '',
          ),
        };
      } catch {
        // Discovery may be unavailable before provider authentication.
      }
      if (this.disposed) throw RequestError.internalError(undefined, 'ACP connection is closed');
      const entry: SessionEntry = {
        ...runtime,
        models: models?.availableModels ?? [],
        state: null,
        queue: Promise.resolve(),
        turns: new Set(),
        unsubscribe: () => {},
        commands: [],
      };
      if (this.disposed) throw RequestError.internalError(undefined, 'ACP connection is closed');
      entry.unsubscribe = runtime.session.subscribe(event => {
        handleAgentControllerEvent(event, entry.state, this.connection, entry.session);
        if (event.type === 'mode_changed') {
          void this.connection
            .sessionUpdate({
              sessionId: thread.id,
              update: { sessionUpdate: 'current_mode_update', currentModeId: entry.session.mode.get() },
            })
            .catch(error => process.stderr.write(`[acp] mode update failed: ${error}\n`));
        }
        if (
          event.type === 'mode_changed' ||
          event.type === 'model_changed' ||
          (event.type === 'state_changed' && event.changedKeys.includes('thinkingLevel'))
        ) {
          void this.connection
            .sessionUpdate({
              sessionId: thread.id,
              update: { sessionUpdate: 'config_option_update', configOptions: this.configOptions(entry) },
            })
            .catch(error => process.stderr.write(`[acp] configuration update failed: ${error}\n`));
        }
      });
      const response: NewSessionResponse = {
        sessionId: thread.id,
        modes: {
          currentModeId: runtime.session.mode.get(),
          availableModes: runtime.modes.map(mode => ({ id: mode.id, name: mode.name ?? mode.id })),
        },
        models,
        configOptions: this.configOptions(entry),
      };
      this.sessions.set(thread.id, entry);
      // Let the SDK send session/new before clients receive updates for this ID.
      setImmediate(() => {
        void this.enqueue(entry, async () => {
          if (!this.disposed) await this.refreshCommands(thread.id, entry);
        }).catch(error => process.stderr.write(`[acp] command discovery failed: ${error}\n`));
      });
      return response;
    } catch (error) {
      try {
        await runtime.cleanup?.();
      } catch (cleanupError) {
        if (this.disposed) this.startupCleanupFailures.push(cleanupError);
        throw cleanupError;
      }
      throw error;
    }
  }

  private async refreshCommands(sessionId: string, entry: SessionEntry): Promise<AcpSkills | undefined> {
    const skills = await entry.getSkills?.();
    const commands = await listSkillCommands(skills);
    if (JSON.stringify(commands) !== JSON.stringify(entry.commands)) {
      await this.connection.sessionUpdate({
        sessionId,
        update: { sessionUpdate: 'available_commands_update', availableCommands: commands },
      });
      entry.commands = commands;
    }
    return skills;
  }

  private configOptions(entry: SessionEntry): SessionConfigOption[] {
    const modelId = entry.session.model.get() ?? '';
    const options: SessionConfigOption[] = [];
    const models = includeCurrentModel(entry.models, modelId);
    if (models.length)
      options.push({
        id: 'model',
        name: 'Model',
        category: 'model',
        type: 'select',
        currentValue: modelId,
        options: models.map(model => ({ value: model.modelId, name: model.name })),
      });
    options.push({
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: entry.session.mode.get(),
      options: entry.modes.map(mode => ({ value: mode.id, name: mode.name ?? mode.id })),
    });
    if (entry.getThinkingLevel)
      options.push({
        id: 'thought_level',
        name: 'Reasoning effort',
        category: 'thought_level',
        type: 'select',
        description: 'Requested reasoning level. The provider may adjust it for the selected model.',
        currentValue: this.thinkingLevel(entry),
        options: getAvailableThinkingLevelsForModel(modelId).map(value => ({
          value,
          name: value[0]!.toUpperCase() + value.slice(1),
        })),
      });
    return options;
  }

  private thinkingLevel(entry: SessionEntry): ThinkingLevelSetting {
    const level = entry.getThinkingLevel?.() ?? 'off';
    const levels = getAvailableThinkingLevelsForModel(entry.session.model.get() ?? '');
    return levels.includes(level) ? level : 'xhigh';
  }

  async setSessionConfigOption(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse> {
    const entry = this.getSession(params.sessionId);
    return this.enqueue(entry, async () => {
      this.getSession(params.sessionId);
      const option = this.configOptions(entry).find(option => option.id === params.configId);
      if (
        !option ||
        option.type !== 'select' ||
        !option.options.some(item => 'value' in item && item.value === params.value)
      ) {
        throw RequestError.invalidParams(undefined, 'Unknown session configuration selection');
      }
      if (params.configId === 'model') {
        await entry.session.model.switch({ modelId: String(params.value) });
      } else if (params.configId === 'mode') {
        await entry.session.mode.switch({ modeId: String(params.value) });
      } else if (isThinkingLevelSetting(params.value)) {
        await entry.session.state.set({ thinkingLevel: params.value });
      }
      if (entry.getThinkingLevel && entry.getThinkingLevel() !== this.thinkingLevel(entry)) {
        await entry.session.state.set({ thinkingLevel: this.thinkingLevel(entry) });
      }
      return { configOptions: this.configOptions(entry) };
    });
  }

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    const entry = this.getSession(request.sessionId);
    const content = extractTextFromContentBlocks(request.prompt);
    const turn = { cancelled: false };
    entry.turns.add(turn);
    try {
      return await this.enqueue(entry, async () => {
        if (turn.cancelled || this.disposed) return { stopReason: 'cancelled' };
        const usage: PromptState['usage'] = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        let complete!: PromptState['resolve'];
        const completion = new Promise<Parameters<PromptState['resolve']>[0]>(resolve => {
          complete = resolve;
        });
        const state: PromptState = {
          sessionId: request.sessionId,
          usage,
          resolve: reason => {
            state.finished = true;
            complete(reason);
          },
        };
        entry.state = state;
        try {
          const skills = await this.refreshCommands(request.sessionId, entry);
          const expanded = await expandSkillCommand(content, skills, entry.commands ?? []);
          if (turn.cancelled || this.disposed) return { stopReason: 'cancelled' };
          await entry.session.sendMessage({ content: expanded });
          const reason = await completion;
          if (reason === 'error' && !state.cancelled && !state.stopReason) {
            throw RequestError.internalError(undefined, state.error?.message ?? 'Mastra Code turn failed');
          }
          return {
            stopReason: state.cancelled ? 'cancelled' : (state.stopReason ?? mapStopReason(reason)),
            usage: {
              inputTokens: usage.promptTokens,
              outputTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
              thoughtTokens: usage.reasoningTokens,
              cachedReadTokens: usage.cachedInputTokens,
              cachedWriteTokens: usage.cacheCreationInputTokens,
            },
          };
        } catch (error) {
          if (state.cancelled) return { stopReason: 'cancelled' };
          if (error instanceof RequestError) throw error;
          throw RequestError.internalError(
            undefined,
            error instanceof Error ? error.message : 'Mastra Code turn failed',
          );
        } finally {
          state.finished = true;
          if (entry.state === state) entry.state = null;
        }
      });
    } finally {
      entry.turns.delete(turn);
    }
  }

  async cancel(notification: CancelNotification): Promise<void> {
    const entry = this.sessions.get(notification.sessionId);
    if (!entry) return;
    for (const turn of entry.turns) turn.cancelled = true;
    if (entry.state && !entry.state.finished && !entry.state.cancelled) {
      const state = entry.state;
      state.cancelled = true;
      // Persist denial before aborting, otherwise a parked snapshot can replay on the next turn.
      for (const deny of state.cancelSuspensions?.values() ?? []) {
        try {
          await deny();
        } catch {
          /* Still abort if the suspended run is no longer available. */
        }
      }
      state.cancelSuspensions?.clear();
      if (entry.state !== state) return;
      entry.session.abort();
      // A suspended run has already ended and will not emit another agent_end.
      if (entry.state?.suspended) {
        entry.session.stream.detach();
        entry.state.resolve('aborted');
      }
    }
  }

  async setSessionMode(params: { sessionId: string; modeId: string }): Promise<void> {
    const entry = this.getSession(params.sessionId);
    if (!entry.modes.some(mode => mode.id === params.modeId))
      throw RequestError.invalidParams(undefined, 'Unknown mode');
    await this.enqueue(entry, async () => {
      if (this.disposed) return;
      await entry.session.mode.switch({ modeId: params.modeId });
    });
  }

  async unstable_setSessionModel(params: { sessionId: string; modelId: string }): Promise<void> {
    const entry = this.getSession(params.sessionId);
    await this.enqueue(entry, async () => {
      if (this.disposed) return;
      if (
        !includeCurrentModel(entry.models, entry.session.model.get() ?? '').some(
          model => model.modelId === params.modelId,
        )
      ) {
        throw RequestError.invalidParams(
          undefined,
          'Model is unavailable or its provider is not configured. Refresh the model list.',
        );
      }
      await entry.session.model.switch({ modelId: params.modelId });
    });
  }
}

function includeCurrentModel(models: SessionEntry['models'], currentModelId: string): SessionEntry['models'] {
  // Saved/custom model IDs may work even when discovery only returns a gateway-qualified alias.
  return currentModelId && !models.some(model => model.modelId === currentModelId)
    ? [{ modelId: currentModelId, name: currentModelId }, ...models]
    : models;
}

export function extractTextFromContentBlocks(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.text);
    } else if (block.type === 'resource_link') {
      parts.push(`[resource: ${block.uri}]`);
    } else if (block.type === 'resource') {
      parts.push(`[resource: ${block.resource.uri}]`);
      if (!('text' in block.resource))
        throw RequestError.invalidParams(undefined, 'Binary prompt resources are not supported');
      parts.push(block.resource.text);
    } else {
      throw RequestError.invalidParams(undefined, `Unsupported prompt content: ${block.type}`);
    }
  }
  return parts.join('\n');
}

export function mapStopReason(
  reason: 'complete' | 'aborted' | 'error' | 'suspended',
): 'end_turn' | 'cancelled' | 'max_tokens' | 'max_turn_requests' | 'refusal' {
  switch (reason) {
    case 'complete':
      return 'end_turn';
    case 'aborted':
      return 'cancelled';
    case 'error':
      throw RequestError.internalError(undefined, 'Mastra Code turn failed');
    case 'suspended':
      return 'end_turn';
  }
}
