import type { PiExtensionGeneration, PiRegisteredCommand } from './types.js';

export interface PiCommandDispatchOptions {
  mode?: 'tui' | 'rpc' | 'json' | 'print';
}

export interface PiOwnedCommand {
  name: string;
  originalName: string;
  description?: string;
  pluginId: string;
  extensionId: string;
  execute(args: string, options?: PiCommandDispatchOptions): Promise<unknown>;
}

function createCommandContext(generation: PiExtensionGeneration, options: PiCommandDispatchOptions) {
  const api = generation.createApi();
  return Object.freeze({
    mode: options.mode ?? 'print',
    sendMessage: api.sendMessage,
    sendUserMessage: api.sendUserMessage,
    appendEntry: api.appendEntry,
    setSessionName: api.setSessionName,
    getSessionName: api.getSessionName,
    setLabel: api.setLabel,
    getActiveTools: api.getActiveTools,
    getAllTools: api.getAllTools,
    setActiveTools: api.setActiveTools,
    refreshTools: api.refreshTools,
    getCommands: api.getCommands,
    getModel: api.getModel,
    setModel: api.setModel,
    getScopedModels: api.getScopedModels,
    getThinkingLevel: api.getThinkingLevel,
    setThinkingLevel: api.setThinkingLevel,
    newSession: api.newSession,
    switchSession: api.switchSession,
    fork: api.fork,
    navigateTree: api.navigateTree,
    isIdle: api.isIdle,
    waitForIdle: api.waitForIdle,
    getPendingMessages: api.getPendingMessages,
    abort: api.abort,
    getContextUsage: api.getContextUsage,
    getSystemPrompt: api.getSystemPrompt,
  });
}

export class PiCommandAdapter {
  readonly #commands = new Map<string, PiOwnedCommand>();

  setGenerations(generations: readonly PiExtensionGeneration[], reservedNames: readonly string[] = []): void {
    this.#commands.clear();
    const nameCounts = new Map(reservedNames.map(name => [name, 1]));
    for (const generation of generations) {
      for (const [originalName, command] of generation.registrations.commands) {
        const count = nameCounts.get(originalName) ?? 0;
        nameCounts.set(originalName, count + 1);
        const name = count === 0 ? originalName : `${originalName}:${count}`;
        if (count > 0) {
          generation.addDiagnostic(
            'warning',
            `Pi command "${originalName}" conflicts with an existing command and is available as "${name}".`,
            'registerCommand',
          );
        }
        this.#commands.set(name, this.#ownedCommand(generation, name, originalName, command));
      }
    }
  }

  list(): PiOwnedCommand[] {
    return [...this.#commands.values()];
  }

  async dispatch(name: string, args = '', options: PiCommandDispatchOptions = {}): Promise<unknown> {
    const command = this.#commands.get(name);
    if (!command) throw new Error(`Pi command not found: ${name}`);
    return command.execute(args, options);
  }

  #ownedCommand(
    generation: PiExtensionGeneration,
    name: string,
    originalName: string,
    command: PiRegisteredCommand,
  ): PiOwnedCommand {
    return {
      name,
      originalName,
      description: command.description,
      pluginId: generation.pluginId,
      extensionId: generation.extensionId,
      execute: async (args, options = {}) => {
        generation.assertActive();
        return command.handler(args, createCommandContext(generation, options));
      },
    };
  }
}
