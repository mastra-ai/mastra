import { execSync } from 'node:child_process';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

function currentGitBranchPattern(): RegExp {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`Branch:\\s+${escaped}`, 'i');
}

export const startupScenario: McE2eScenario = {
  name: 'startup',
  description: 'Start real Mastra Code and open /help.',
  testName: 'observe real Mastra Code startup',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);
    await runtime.waitForScreenText(currentGitBranchPattern(), terminal);
    await runtime.waitForScreenText(/User:\s+mc-e2e/i, terminal);
    runtime.printScreen('after startup', terminal);

    terminal.submit('/help');
    await runtime.sleep(1_000);
    runtime.printScreen('after /help', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
