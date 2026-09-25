import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario, McE2eTerminal } from './types.js';

function expectSingleStatusFooterBelowEditor(terminal: McE2eTerminal, label: string): void {
  const rows = terminal.serialize().view.split('\n');
  const statusRows = rows.flatMap((row, index) => (row.includes('▐build▌') ? [index] : []));
  const aboveStatus = statusRows.length === 1 ? rows[statusRows[0]! - 1] : undefined;

  if (statusRows.length !== 1 || !/^\s*╰─+╯\s*$/.test(aboveStatus ?? '')) {
    throw new Error(
      `${label}: expected one status footer directly below the editor border, found ${statusRows.length} ` +
        `at rows ${statusRows.map(row => row + 1).join(', ')}\n\n${rows.join('\n')}`,
    );
  }
}

export const statusFooterInlineStartScenario: McE2eScenario = {
  name: 'status-footer-inline-start',
  description:
    'Start Mastra Code below existing shell output and assert the animated status footer stays in place while the transcript is shorter than the terminal.',
  testName: 'animates the status footer in place when started below shell output',
  useOpenAIModel: true,
  aimockFixture: 'status-footer-inline-start.json',
  enableTitleGeneration: true,
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, any>;
    settings.models = { ...settings.models, observerModelOverride: 'openai/gpt-5.4-mini' };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ terminal, startMastraCodeApp }) {
    // pi-tui renders inline from the current cursor row, like launching from a shell prompt.
    terminal.write('$ mastracode\r\n');
    return startMastraCodeApp();
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await expect(terminal.getByText(/Project:|Resource ID:/gi, { full: true, strict: false })).toBeVisible();
    await runtime.waitForScreenText(/^\$ mastracode/m, terminal);
    expectSingleStatusFooterBelowEditor(terminal, 'after startup');

    terminal.submit('Animate the status footer.');
    await runtime.waitForScreenText(/» Animate the status footer\./, terminal);
    // The response fixture holds time-to-first-token so the footer animation runs on its own.
    await runtime.sleep(1_000);
    runtime.printScreen('while the footer animates', terminal);
    expectSingleStatusFooterBelowEditor(terminal, 'while the footer animates');

    await runtime.waitForScreenText(/Status footer animation complete\./, terminal);
    await runtime.waitForScreenText(/Status footer title/i, terminal, 10_000);
    expectSingleStatusFooterBelowEditor(terminal, 'after the response');
  },
};
