import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const workspaceCommandsScenario: McE2eScenario = {
  name: 'workspace-commands',
  description: 'Exercise visible workspace and lifecycle command fallback surfaces through the real TUI.',
  testName: 'shows skills and hooks command feedback in the real TUI',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    terminal.submit('/skills');
    await runtime.waitForScreenText(/No (skills configured|user-invokable skills found)|Skills \(/i, terminal);
    await runtime.waitForScreenText(/SKILL\.md|Skills are automatically activated|Install skills/i, terminal);
    runtime.printScreen('after /skills', terminal);

    terminal.submit('/hooks');
    await runtime.waitForScreenText(/Hooks system not initialized|No hooks configured|Hooks Configuration/i, terminal);
    runtime.printScreen('after /hooks', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
};
