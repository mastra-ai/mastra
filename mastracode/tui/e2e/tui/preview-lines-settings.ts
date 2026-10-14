import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import { selectMenuRow } from './menu-navigation.js';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

let restartApp: (() => Promise<void>) | undefined;

function settingsPathFromRunEnv(): string {
  const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
    (config: { scenarioName?: string }) => config.scenarioName === 'preview-lines-settings',
  ) as { env?: Record<string, string | null> } | undefined;
  const settingsPath = runConfig?.env?.MC_E2E_PREVIEW_SETTINGS_PATH;
  if (!settingsPath) throw new Error('Missing preview lines settings path');
  return settingsPath;
}

function shellPreviewLines(terminal: McE2eTerminal): string[] {
  return terminal
    .serialize()
    .view.split('\n')
    .flatMap(line => line.match(/│ (preview-line-\d)/)?.[1] ?? []);
}

function assertPreview(label: string, terminal: McE2eTerminal, expected: string[]): void {
  const actual = shellPreviewLines(terminal);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function choosePreviewLines(
  terminal: McE2eTerminal,
  runtime: McE2eScenarioRuntime,
  option: RegExp,
): Promise<void> {
  terminal.submit('/settings');
  await runtime.waitForScreenText(/Enter\/Space to change/i, terminal);
  await selectMenuRow(terminal, /Preview lines/i);
  // Wait for the submenu so option navigation doesn't read the main list's highlight.
  await runtime.waitForScreenText(/Show up to 1 preview line\b/i, terminal);
  await selectMenuRow(terminal, option);
}

export const previewLinesSettingsScenario: McE2eScenario = {
  name: 'preview-lines-settings',
  description:
    'Change Preview lines through the real settings overlay and verify it applies live, persists across reopen and restart, and that no display-mode row exists.',
  testName: 'updates Preview lines live and persists it across reopen and restart',
  // A git-initialized project so the app's project root is the isolated temp dir, not this repo.
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'preview-lines-settings.json',
  env({ appDataDir }) {
    return { MC_E2E_PREVIEW_SETTINGS_PATH: join(appDataDir, 'settings.json') };
  },
  async inProcessApp({ startMastraCodeApp }) {
    let currentStop: (() => Promise<void> | void) | undefined;
    const start = async () => {
      const app = await startMastraCodeApp();
      currentStop = app.stop;
    };
    restartApp = async () => {
      await currentStop?.();
      await start();
    };
    await start();
    return { stop: async () => currentStop?.() };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Print the preview lines fixture.');
    await runtime.waitForScreenText(/Preview lines fixture complete\./i, terminal, 20_000);
    await runtime.waitForScreenText(/✓ Printing six preview lines/i, terminal, 5_000);
    assertPreview('default preview', terminal, ['preview-line-5', 'preview-line-6']);

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Preview lines\s+2 lines/i, terminal);
    runtime.printScreen('settings initial', terminal);
    expect(terminal.serialize().view).not.toMatch(/Quiet mode/i);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Preview lines\s+2 lines/i, terminal, 8_000);

    await choosePreviewLines(terminal, runtime, /4 lines/);
    await runtime.waitForScreenText(/Preview lines\s+4 lines/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Preview lines\s+4 lines/i, terminal, 8_000);
    runtime.printScreen('preview lines 4 applied live', terminal);
    assertPreview('live preview at 4', terminal, [
      'preview-line-3',
      'preview-line-4',
      'preview-line-5',
      'preview-line-6',
    ]);

    await choosePreviewLines(terminal, runtime, /None/);
    await runtime.waitForScreenText(/Preview lines\s+None/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Preview lines\s+None/i, terminal, 8_000);
    runtime.printScreen('preview lines none applied live', terminal);
    assertPreview('live preview at None', terminal, []);

    await choosePreviewLines(terminal, runtime, /8 lines/);
    await runtime.waitForScreenText(/Preview lines\s+8 lines/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Preview lines\s+8 lines/i, terminal, 8_000);
    assertPreview(
      'live preview at 8',
      terminal,
      [1, 2, 3, 4, 5, 6].map(n => `preview-line-${n}`),
    );

    await choosePreviewLines(terminal, runtime, /4 lines/);
    await runtime.waitForScreenText(/Preview lines\s+4 lines/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Preview lines\s+4 lines/i, terminal, 8_000);

    terminal.submit('/settings');
    await runtime.waitForScreenText(/Preview lines\s+4 lines/i, terminal);
    runtime.printScreen('settings reopened', terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Preview lines\s+4 lines/i, terminal, 8_000);

    const saved = JSON.parse(readFileSync(settingsPathFromRunEnv(), 'utf8'));
    if (saved.preferences?.previewLines !== 4) {
      throw new Error(`Expected previewLines 4 on disk, received ${JSON.stringify(saved.preferences)}`);
    }
    if ('quietModeMaxToolPreviewLines' in saved.preferences || 'quietMode' in saved.preferences) {
      throw new Error(`Changing Preview lines wrote a legacy key: ${JSON.stringify(saved.preferences)}`);
    }

    await restartApp?.();
    await runtime.waitForScreenText(/Project:/i, terminal, 30_000);
    terminal.submit('/settings');
    await runtime.waitForScreenText(/Preview lines\s+4 lines/i, terminal);
    runtime.printScreen('settings after restart', terminal);
    terminal.write('\x1b');
  },
};
