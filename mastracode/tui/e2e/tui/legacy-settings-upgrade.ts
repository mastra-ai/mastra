import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const LEGACY_SETTINGS = {
  onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1, quietModePreferenceSelected: true },
  models: { activeModelPackId: null, modeDefaults: { build: 'openai/gpt-5.4-mini', plan: 'openai/gpt-5.4-mini' } },
  preferences: { quietMode: false, quietModeMaxToolPreviewLines: 4 },
};

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function settingsPathFromRunEnv(): string {
  const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
    (config: { scenarioName?: string }) => config.scenarioName === 'legacy-settings-upgrade',
  ) as { env?: Record<string, string | null> } | undefined;
  const settingsPath = runConfig?.env?.MC_E2E_LEGACY_SETTINGS_PATH;
  if (!settingsPath) throw new Error('Missing legacy settings path');
  return settingsPath;
}

export const legacySettingsUpgradeScenario: McE2eScenario = {
  name: 'legacy-settings-upgrade',
  description:
    'Start with a classic-mode settings file from an older release and verify compact rendering, the migrated preview line count, and untouched legacy keys.',
  testName: 'renders compact tools for a legacy classic-mode user and keeps the legacy settings keys',
  // A git-initialized project so the app's project root is the isolated temp dir, not this repo.
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'legacy-settings-upgrade.json',
  env({ appDataDir }) {
    return { MC_E2E_LEGACY_SETTINGS_PATH: join(appDataDir, 'settings.json') };
  },
  prepare({ appDataDir, projectDir }) {
    // Replace the harness seed entirely so the file is exactly what an older release left behind.
    writeFileSync(join(appDataDir, 'settings.json'), JSON.stringify(LEGACY_SETTINGS, null, 2));
    writeFileSync(
      join(projectDir, 'legacy-upgrade.txt'),
      [1, 2, 3, 4, 5, 6].map(n => `view-body-${n}`).join('\n') + '\n',
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Check the legacy upgrade fixture.');
    await runtime.waitForScreenText(/Legacy upgrade check complete\./i, terminal, 20_000);
    runtime.printScreen('legacy user after upgrade', terminal);

    const view = terminal.serialize().view;
    const railLines = (prefix: string) =>
      view.split('\n').flatMap(line => line.match(new RegExp(`│ (${prefix}-\\d)`))?.[1] ?? []);
    // Compact view row (not the classic file box with every line), previewing the migrated 4 lines.
    // A successful compact row has no status glyph after it; failures end in ✗.
    expect(view).toMatch(/▐view▌legacy-upgrade\.txt▌ *$/m);
    assertEqual('view preview lines', railLines('view-body'), [
      'view-body-3',
      'view-body-4',
      'view-body-5',
      'view-body-6',
    ]);
    // Grouped shell box: the description is the boxed footer row (not the classic "• $ printf" header),
    // and the box previews exactly the migrated 4 lines.
    expect(view).toMatch(/│ ✓ Printing six upgrade lines/);
    expect(view).not.toMatch(/^• \$ printf/m);
    assertEqual('shell preview lines', railLines('upgrade-line'), [
      'upgrade-line-3',
      'upgrade-line-4',
      'upgrade-line-5',
      'upgrade-line-6',
    ]);

    terminal.write('\x05');
    await runtime.waitForScreenText(/upgrade-line-1/, terminal, 8_000);
    runtime.printScreen('legacy user after ctrl+e', terminal);

    const settings = JSON.parse(readFileSync(settingsPathFromRunEnv(), 'utf8'));
    assertEqual('settings.preferences.previewLines', settings.preferences.previewLines, 4);
    assertEqual('settings.preferences.quietMode', settings.preferences.quietMode, false);
    assertEqual(
      'settings.preferences.quietModeMaxToolPreviewLines',
      settings.preferences.quietModeMaxToolPreviewLines,
      4,
    );
    assertEqual(
      'settings.onboarding.quietModePreferenceSelected',
      settings.onboarding.quietModePreferenceSelected,
      true,
    );

    terminal.keyCtrlC();
  },
};
