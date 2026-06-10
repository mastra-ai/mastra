import type { McE2eScenario } from './types.js';

const PROMPT = 'List the available workspace tool aliases.';
const RESPONSE = 'Workspace tool aliases verified.';
const RESPONSE_PATTERN = new RegExp(RESPONSE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

function getToolNames(requests: unknown[]): string[] {
  const names = new Set<string>();
  for (const request of requests as Array<{ body?: { tools?: unknown[] } }>) {
    for (const tool of request.body?.tools ?? []) {
      const name =
        (tool as { function?: { name?: unknown }; name?: unknown }).function?.name ?? (tool as { name?: unknown }).name;
      if (typeof name === 'string') names.add(name);
    }
  }
  return [...names].sort();
}

export const workspaceToolNamesScenario: McE2eScenario = {
  name: 'workspace-tool-names',
  description: 'Verify provider-visible workspace tools use Mastra Code stable aliases.',
  testName: 'exposes stable workspace tool aliases to the model request',
  useOpenAIModel: true,
  aimockFixture: 'workspace-tool-names.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit(PROMPT);
    await runtime.waitForScreenText(RESPONSE_PATTERN, terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const names = getToolNames(requests);
    for (const expected of ['view', 'find_files', 'search_content', 'execute_command', 'lsp_inspect']) {
      if (!names.includes(expected)) {
        throw new Error(
          `Expected provider request to expose workspace tool alias ${expected}. Names: ${names.join(', ')}`,
        );
      }
    }
    const legacyName = names.find(name => name.startsWith('mastra_workspace_'));
    if (legacyName) {
      throw new Error(`Expected old workspace tool IDs to be hidden, found ${legacyName}. Names: ${names.join(', ')}`);
    }
  },
};
