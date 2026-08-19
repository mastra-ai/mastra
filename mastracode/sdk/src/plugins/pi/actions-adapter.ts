import type { PiOwnedCommand } from './command-adapter.js';
import { PiMessageAdapter, type PiMessageSession } from './message-adapter.js';
import { PiModelAdapter, type PiModelHost } from './model-adapter.js';
import { PiProviderAdapter } from './provider-adapter.js';
import { PiStateStore, type PiStateBackend } from './state-store.js';
import { PiThreadAdapter, type PiThreadHost } from './thread-adapter.js';
import type { PiExtensionGeneration, PiRuntimeActions } from './types.js';

const activeToolRequests = new WeakMap<PiExtensionGeneration, readonly string[]>();

export function getPiActiveToolRequest(generation: PiExtensionGeneration): readonly string[] | undefined {
  return activeToolRequests.get(generation);
}

export interface PiActionHost {
  getMessageSession(): PiMessageSession | undefined;
  getThreadHost(): PiThreadHost | undefined;
  getStateBackend(): PiStateBackend | undefined;
  getModelHost(): PiModelHost | undefined;
  listTools(): Promise<string[]>;
  getActiveTools(): Promise<string[]>;
  setActiveTools(tools: string[]): Promise<void>;
  refreshTools(): Promise<void>;
  exec(command: string, args: string[], options?: { cwd?: string }): Promise<unknown>;
  isIdle(): boolean;
  waitForIdle(signal: AbortSignal): Promise<void>;
  getPendingMessages(): unknown;
  abort(): void;
  getContextUsage(): unknown;
  getSystemPrompt(): string | Promise<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function required<T>(value: T | undefined, generation: PiExtensionGeneration, name: string): T {
  if (value !== undefined) return value;
  throw new Error(`Pi extension "${generation.extensionId}" has no active ${name} facade.`);
}

async function waitForIdleWithTimeout(generation: PiExtensionGeneration, host: PiActionHost): Promise<void> {
  const controller = new AbortController();
  const abortForStaleGeneration = () => controller.abort(generation.staleSignal.reason);
  generation.staleSignal.addEventListener('abort', abortForStaleGeneration, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('Pi waitForIdle timed out after 300 seconds')), 300_000);
  timer.unref?.();
  try {
    await host.waitForIdle(controller.signal);
  } finally {
    clearTimeout(timer);
    generation.staleSignal.removeEventListener('abort', abortForStaleGeneration);
  }
}

function sendMessageOptions(value: unknown): { triggerTurn?: boolean } | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('Pi sendMessage options must be an object');
  if (value.triggerTurn !== undefined && typeof value.triggerTurn !== 'boolean') {
    throw new Error('Pi sendMessage triggerTurn must be boolean');
  }
  return { triggerTurn: value.triggerTurn };
}

function messageOptions(value: unknown): {
  deliverAs?: 'steer' | 'followUp';
  triggerTurn?: boolean;
  expandPromptTemplates?: boolean;
} {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error('Pi sendUserMessage options must be an object');
  if (value.deliverAs !== undefined && value.deliverAs !== 'steer' && value.deliverAs !== 'followUp') {
    throw new Error('Pi sendUserMessage deliverAs must be steer or followUp');
  }
  if (value.triggerTurn !== undefined && typeof value.triggerTurn !== 'boolean') {
    throw new Error('Pi sendUserMessage triggerTurn must be boolean');
  }
  if (value.expandPromptTemplates !== undefined && typeof value.expandPromptTemplates !== 'boolean') {
    throw new Error('Pi sendUserMessage expandPromptTemplates must be boolean');
  }
  return {
    deliverAs: value.deliverAs,
    triggerTurn: value.triggerTurn,
    expandPromptTemplates: value.expandPromptTemplates,
  };
}

function modelSelection(value: unknown): string | { id?: string; provider?: string; modelName?: string } {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) throw new Error('Pi setModel requires a model ID or model object');
  for (const key of ['id', 'provider', 'modelName'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw new Error(`Pi setModel ${key} must be a string`);
    }
  }
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    provider: typeof value.provider === 'string' ? value.provider : undefined,
    modelName: typeof value.modelName === 'string' ? value.modelName : undefined,
  };
}

function threadOptions(value: unknown, action: 'newSession' | 'fork'): { sourceThreadId?: string; name?: string } {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`Pi ${action} options must be an object`);
  if (value.name !== undefined && typeof value.name !== 'string') throw new Error(`Pi ${action} name must be a string`);
  if (value.sourceThreadId !== undefined && typeof value.sourceThreadId !== 'string') {
    throw new Error(`Pi ${action} sourceThreadId must be a string`);
  }
  return {
    name: typeof value.name === 'string' ? value.name : undefined,
    sourceThreadId: typeof value.sourceThreadId === 'string' ? value.sourceThreadId : undefined,
  };
}

export function createPiRuntimeActions(options: {
  generation: PiExtensionGeneration;
  host: PiActionHost;
  commands: { list(): PiOwnedCommand[] };
  providers: PiProviderAdapter;
}): PiRuntimeActions {
  const { generation, host, commands, providers } = options;
  const messages = new PiMessageAdapter(generation, () => host.getMessageSession());
  const model = new PiModelAdapter(generation, () => host.getModelHost());
  const threads = new PiThreadAdapter(generation, () => host.getThreadHost());
  const state = () => new PiStateStore(generation, required(host.getStateBackend(), generation, 'state'));

  return {
    sendMessage: (message, sendOptions) => messages.sendMessage(message, sendMessageOptions(sendOptions)),
    sendUserMessage: (message, sendOptions) => messages.sendUserMessage(message, messageOptions(sendOptions)),
    appendEntry: (type, data) => state().append(String(type), data),
    setSessionName: name => threads.setSessionName(String(name)),
    getSessionName: () => threads.getSessionName(),
    setLabel: (key, value) => state().append(`label:${String(key)}`, value),
    exec: (command, args, execOptions) => {
      if (typeof command !== 'string' || !Array.isArray(args) || !args.every(arg => typeof arg === 'string')) {
        throw new Error('Pi exec requires a command and string argument array');
      }
      return host.exec(command, args, {
        cwd: isRecord(execOptions) && typeof execOptions.cwd === 'string' ? execOptions.cwd : undefined,
      });
    },
    getActiveTools: () => host.getActiveTools(),
    getAllTools: () => host.listTools(),
    setActiveTools: async tools => {
      if (!Array.isArray(tools) || !tools.every(tool => typeof tool === 'string')) {
        throw new Error('Pi setActiveTools requires an array of tool names');
      }
      const available = new Set(await host.listTools());
      const requested = tools.filter((tool): tool is string => typeof tool === 'string');
      const unavailable = requested.filter(tool => !available.has(tool));
      if (unavailable.length > 0) {
        throw new Error(`Pi extension cannot activate unavailable tools: ${unavailable.join(', ')}`);
      }
      await host.setActiveTools(requested);
      activeToolRequests.set(generation, requested);
    },
    refreshTools: () => host.refreshTools(),
    getCommands: () => commands.list(),
    setModel: value => model.setModel(modelSelection(value)),
    getModel: () => model.getModel(),
    getScopedModels: () => model.getScopedModels(),
    getThinkingLevel: () => model.getThinkingLevel(),
    setThinkingLevel: level => model.setThinkingLevel(String(level)),
    registerProvider: (name, config) => providers.register(generation, String(name), config),
    unregisterProvider: name => providers.unregister(generation, String(name)),
    newSession: options => threads.newSession(threadOptions(options, 'newSession')),
    switchSession: threadId => {
      if (typeof threadId !== 'string') throw new Error('Pi switchSession requires a thread ID');
      return threads.switchSession(threadId);
    },
    fork: options => threads.fork(threadOptions(options, 'fork')),
    navigateTree: () => threads.navigateTree(),
    isIdle: () => host.isIdle(),
    waitForIdle: () => waitForIdleWithTimeout(generation, host),
    getPendingMessages: () => host.getPendingMessages(),
    abort: () => host.abort(),
    getContextUsage: () => host.getContextUsage(),
    getSystemPrompt: () => host.getSystemPrompt(),
  };
}
