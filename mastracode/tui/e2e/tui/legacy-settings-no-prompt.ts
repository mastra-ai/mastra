import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

// A classic-mode user from before the quiet mode rollout: no onboarding preference key.
const LEGACY_SETTINGS = {
  onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
  preferences: { quietMode: false },
};

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function settingsPathFromRunEnv(): string {
  const runConfig = JSON.parse(process.env.MC_E2E_RUNS_JSON ?? '[]').find(
    (config: { scenarioName?: string }) => config.scenarioName === 'legacy-settings-no-prompt',
  ) as { env?: Record<string, string | null> } | undefined;
  const settingsPath = runConfig?.env?.MC_E2E_LEGACY_SETTINGS_PATH;
  if (!settingsPath) throw new Error('Missing legacy settings path');
  return settingsPath;
}

export const legacySettingsNoPromptScenario: McE2eScenario = {
  name: 'legacy-settings-no-prompt',
  description:
    'Start with classic-mode settings that never answered the quiet mode prompt and verify startup shows no display-mode prompt.',
  testName: 'starts a legacy classic-mode user without a display-mode prompt',
  // A git-initialized project so the app's project root is the isolated temp dir, not this repo.
  projectFixture: 'long-branch',
  env({ appDataDir }) {
    return { MC_E2E_LEGACY_SETTINGS_PATH: join(appDataDir, 'settings.json') };
  },
  prepare({ appDataDir }) {
    writeFileSync(join(appDataDir, 'settings.json'), JSON.stringify(LEGACY_SETTINGS, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:|Try compact quiet mode/i, terminal);
    // Give a startup prompt time to appear before asserting it never does.
    await runtime.sleep(1_500);
    runtime.printScreen('legacy user startup', terminal);
    const view = terminal.serialize().view;
    expect(view).not.toMatch(/Try compact quiet mode/i);
    expect(view).toMatch(/Project:/i);

    const settings = JSON.parse(readFileSync(settingsPathFromRunEnv(), 'utf8'));
    assertEqual('settings.preferences.previewLines', settings.preferences.previewLines, 2);
    assertEqual('settings.preferences.quietMode', settings.preferences.quietMode, false);
    assertEqual('quietModePreferenceSelected present', 'quietModePreferenceSelected' in settings.onboarding, false);

    terminal.keyCtrlC();
  },
};
