import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const workspaceToolOutputRenderingScenario: McE2eScenario = {
  name: 'workspace-tool-output-rendering',
  description: 'Drive workspace shell and LSP tools and verify visible TUI output rendering.',
  testName: 'renders execute_command and lsp_inspect workspace tool results',
  skipReason: 'current main repeats workspace tool calls and never reaches final assistant completion text',
  useOpenAIModel: true,
  aimockFixture: 'workspace-tool-output-rendering.json',
  prepare({ projectDir }) {
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(join(projectDir, 'src', 'workspace-output-e2e.ts'), 'export const WORKSPACE_E2E_SYMBOL = 42;\n');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Render workspace shell and lsp outputs.');

    await runtime.waitForScreenText(/\$ printf 'WORKSPACE_E2E_SHELL_OUTPUT/i, terminal, 10_000);
    await runtime.waitForScreenText(/│ WORKSPACE_E2E_SHELL_OUTPUT/i, terminal, 10_000);
    await runtime.waitForScreenText(/lsp_inspect\s+src\/workspace-output-e2e\.ts\s+L1/i, terminal, 15_000);
    await runtime.waitForScreenText(/WORKSPACE_E2E_SYMBOL/i, terminal, 15_000);
    await runtime.waitForScreenText(/Workspace tool output rendering complete\./i, terminal, 15_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected workspace tool output scenario to make 2 AIMock requests, received ${requests.length}`);
    }
    const serialized = JSON.stringify(requests);
    for (const needle of ['call_workspace_shell', 'call_workspace_lsp', 'execute_command', 'lsp_inspect']) {
      if (!serialized.includes(needle)) {
        throw new Error(`Expected AIMock request flow to include ${needle}`);
      }
    }
  },
};
