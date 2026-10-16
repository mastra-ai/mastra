import { RemoteController } from '@mastra/code-sdk/factory/remote-controller';
import { RemoteSession } from '@mastra/code-sdk/factory/remote-session';

import type { McE2eScenario } from './types.js';

const address = { url: 'https://factory.e2e.test', session: { token: 'mc-e2e-token', orgId: 'org-e2e' } };
const sentMessages: string[] = [];

// Stands in for the Factory agent-controller session that client-js would talk to over HTTP.
function fakeFactorySession() {
  let emit: (event: any) => void = () => {};
  return {
    create: async () => {},
    state: async () => ({
      threadId: 'factory-thread-1',
      modeId: 'build',
      modelId: 'factory/e2e-model',
      running: false,
    }),
    subscribe: async ({ onEvent }: { onEvent: (event: any) => void }) => {
      emit = onEvent;
      return { unsubscribe: () => {} };
    },
    listModes: async () => [{ id: 'build', name: 'Build', default: true }],
    listModels: async () => [
      { id: 'factory/e2e-model', provider: 'factory', modelName: 'e2e-model', hasApiKey: true, useCount: 0 },
    ],
    listThreads: async () => [
      { id: 'factory-thread-1', title: 'Factory thread', createdAt: new Date(), updatedAt: new Date() },
    ],
    listMessages: async () => [],
    sendMessage: async (input: string | { content: string }) => {
      const content = typeof input === 'string' ? input : input.content;
      sentMessages.push(content);
      emit({ type: 'error', error: { name: 'Error', message: `Factory received: ${content}` } });
    },
    followUp: async () => {},
    abort: async () => {},
    switchModel: async () => {},
    switchMode: async () => {},
    setState: async () => {},
    getPermissions: async () => ({ categories: {}, tools: {} }),
  };
}

export const factoryClientModeScenario: McE2eScenario = {
  name: 'factory-client-mode',
  description: 'Boot the TUI as a Factory thin client without constructing the local Mastra Code stack.',
  testName: 'renders Factory info, gates local-only commands, and forwards prompts to the Factory',
  async inProcessApp({ terminal }) {
    const [{ MastraTUI }] = await Promise.all([import('../../src/tui/index.js')]);
    const remote = fakeFactorySession();
    const session = new RemoteSession(address, 'factory-session-1', remote as any);
    const controller = new RemoteController(address, remote as any);
    await Promise.all([session.connect(), controller.connect()]);
    session.setModes(controller.listModes());

    const tui = new MastraTUI({
      runtime: 'factory',
      controller,
      session,
      factory: {
        projectName: 'acme',
        repositorySlug: 'acme/widgets',
        branch: 'user/session-factory-session-1',
        url: address.url,
      },
      appName: 'Mastra Code',
      version: 'mc-e2e-terminal',
      inlineQuestions: true,
      terminal,
    });
    void tui.run().catch(error => {
      process.stderr.write(
        `[mc-e2e:factory] TUI run failed: ${error instanceof Error ? error.stack : String(error)}\n`,
      );
    });
    return { stop: () => tui.stop() };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Factory:\s+acme/i, terminal);
    await runtime.waitForScreenText(/Repository:\s+acme\/widgets/i, terminal);
    await runtime.waitForScreenText(/user\/session-factory-session-1/i, terminal);
    await runtime.waitForScreenTextAbsent(/Resource ID:/i, terminal, 1_000);
    runtime.printScreen('factory startup', terminal);

    terminal.submit('/mcp');
    await runtime.waitForScreenText(/\/mcp is not available in Factory mode/i, terminal, 8_000);

    terminal.submit('hello factory');
    await runtime.waitForScreenText(/Factory received: hello factory/i, terminal, 8_000);
    if (!sentMessages.includes('hello factory')) throw new Error('prompt was not forwarded to the Factory session');
    runtime.printScreen('after prompt', terminal);

    terminal.keyCtrlC();
  },
};
