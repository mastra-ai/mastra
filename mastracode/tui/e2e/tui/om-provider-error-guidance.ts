import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

let showOMError: ((error: Error) => Promise<void>) | undefined;

export const omProviderErrorGuidanceScenario = {
  name: 'om-provider-error-guidance',
  description: 'Explains how to recover when the configured OM provider cannot authenticate.',
  testName: 'names the active OM model and recommends /memory or /connect',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = readMutableSettingsFixture(settingsPath);
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      omPackId: 'custom',
      quietModePreferenceSelected: true,
    };
    settings.models = {
      ...settings.models,
      activeOmPackId: 'custom',
      omModelOverride: 'google/gemini-3.5-flash',
      observerModelOverride: null,
      reflectorModelOverride: null,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }) {
    const app = await startMastraCodeApp({
      onTuiCreated(tui) {
        if ((typeof tui !== 'object' && typeof tui !== 'function') || tui === null) {
          throw new Error('Expected a TUI instance');
        }
        const handleEvent = Reflect.get(tui, 'handleEvent');
        if (typeof handleEvent !== 'function') {
          throw new Error('Expected the TUI to expose its event handler');
        }
        showOMError = async error => {
          await Reflect.apply(handleEvent, tui, [{ type: 'error', error, retryable: false }]);
        };
      },
    });
    return {
      stop() {
        showOMError = undefined;
        return app.stop?.();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    if (!showOMError) throw new Error('Expected the TUI error handler to be ready');
    await showOMError(
      new Error(
        'Observational memory observation run failed: Authentication failed: GOOGLE_GENERATIVE_AI_API_KEY is not set',
      ),
    );

    await runtime.waitForScreenText(/Observational Memory is using google\/gemini-3.5-flash/i, terminal, 8_000);
    // \s+ between words: the hint wraps across terminal lines
    await runtime.waitForScreenText(/Use\s+\/connect\s+to\s+authenticate\s+with\s+a\s+provider/i, terminal, 8_000);
    await runtime.waitForScreenText(/Use\s+\/memory\s+to\s+choose\s+another\s+OM\s+model/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
