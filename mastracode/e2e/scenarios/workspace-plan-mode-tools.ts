import type { McE2eScenario } from './types.js';

const BUILD_PROMPT = 'Record the build-mode workspace tool list.';
const PLAN_PROMPT = 'Record the plan-mode workspace tool list.';

function getUserMessage(request: unknown): string {
  const messages =
    (request as { body?: { messages?: Array<{ role?: string; content?: unknown }> } }).body?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      const text = message.content
        .map(part =>
          (part as { text?: unknown }).text && typeof (part as { text?: unknown }).text === 'string'
            ? (part as { text: string }).text
            : '',
        )
        .filter(Boolean)
        .join('\n');
      if (text) return text;
    }
  }
  return '';
}

function getToolNames(request: unknown): string[] {
  const names = new Set<string>();
  for (const tool of (request as { body?: { tools?: unknown[] } }).body?.tools ?? []) {
    const name =
      (tool as { function?: { name?: unknown }; name?: unknown }).function?.name ?? (tool as { name?: unknown }).name;
    if (typeof name === 'string') names.add(name);
  }
  return [...names].sort();
}

function findRequestTools(requests: unknown[], userMessage: string): string[] {
  const request = requests.find(candidate => getUserMessage(candidate).includes(userMessage));
  if (!request) {
    throw new Error(`Expected AIMock request for ${userMessage}. Saw: ${requests.map(getUserMessage).join(' | ')}`);
  }
  return getToolNames(request);
}

function assertIncludes(names: string[], expected: string, label: string) {
  if (!names.includes(expected)) {
    throw new Error(`Expected ${label} tools to include ${expected}. Names: ${names.join(', ')}`);
  }
}

function assertExcludes(names: string[], unexpected: string, label: string) {
  if (names.includes(unexpected)) {
    throw new Error(`Expected ${label} tools to exclude ${unexpected}. Names: ${names.join(', ')}`);
  }
}

export const workspacePlanModeToolsScenario: McE2eScenario = {
  name: 'workspace-plan-mode-tools',
  description: 'Verify plan mode filters workspace write tools while keeping edit for plan revisions.',
  testName: 'filters workspace write tools from plan-mode model requests',
  useOpenAIModel: true,
  aimockFixture: 'workspace-plan-mode-tools.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);

    terminal.submit(BUILD_PROMPT);
    await runtime.waitForScreenText(/Build-mode workspace tools observed\./i, terminal, 10_000);

    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/▐plan▌/i, terminal, 8_000);

    terminal.submit(PLAN_PROMPT);
    await runtime.waitForScreenText(/Plan-mode workspace tools observed\./i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const buildNames = findRequestTools(requests, BUILD_PROMPT);
    const planNames = findRequestTools(requests, PLAN_PROMPT);

    for (const expected of ['view', 'find_files', 'search_content', 'lsp_inspect']) {
      assertIncludes(buildNames, expected, 'build-mode');
      assertIncludes(planNames, expected, 'plan-mode');
    }

    // write_file and ast_smart_edit are disabled in plan mode
    for (const writeTool of ['write_file', 'ast_smart_edit']) {
      assertIncludes(buildNames, writeTool, 'build-mode');
      assertExcludes(planNames, writeTool, 'plan-mode');
    }

    // string_replace_lsp stays enabled in plan mode for targeted plan file edits
    assertIncludes(buildNames, 'string_replace_lsp', 'build-mode');
    assertIncludes(planNames, 'string_replace_lsp', 'plan-mode');
  },
};
