import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const firstRunOnboardingScenario: McE2eScenario = {
  name: 'first-run-onboarding',
  description: 'Launch with a clean config dir and verify first-run onboarding can be skipped through the real TUI.',
  testName: 'shows first-run onboarding from clean config and returns to the TUI after skip',
  prepare({ appDataDir }) {
    rmSync(join(appDataDir, 'settings.json'), { force: true });
    rmSync(join(appDataDir, 'auth.json'), { force: true });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Welcome to Mastra Code/i, terminal);
    await runtime.waitForScreenText(/Let's configure your models and preferences/i, terminal);
    await runtime.waitForScreenText(/Skip/i, terminal);

    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);
    await (expect(terminal.getByText(/›|>/gi, { full: true, strict: false })) as any).toBeVisible();

    const screen = terminal.serialize().view;
    if (/Welcome to Mastra Code|Authentication|Model Packs/i.test(screen)) {
      throw new Error('Expected onboarding overlay to be dismissed after selecting Skip');
    }

    terminal.keyCtrlC();
  },
};
