import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const provider = '302ai';
const envVar = '302AI_API_KEY';
const storedKey = 'mc-e2e-stored-delete-key';
const realEnvKey = 'mc-e2e-real-env-key';

export const apiKeyDeleteEnvScenario = {
  name: 'api-key-delete-env',
  description: 'Deletes a stored API key without clearing an existing shell environment key.',
  testName: 'removes a stored API key while preserving an existing env key projection',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'auth.json'),
      JSON.stringify(
        {
          [`apikey:${provider}`]: {
            type: 'api_key',
            key: storedKey,
          },
        },
        null,
        2,
      ),
    );
  },
  env() {
    return {
      [envVar]: realEnvKey,
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/api-keys');
    await runtime.waitForScreenText(/API Keys/i, terminal, 8_000);
    await runtime.waitForScreenText(/302ai\s+✓ \(stored\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Key stored locally\. Press Enter to update or Delete to remove\./i, terminal, 8_000);

    terminal.write('\x7f');
    await runtime.waitForScreenText(/302ai\s+✓ \(env\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Key set via environment variable/i, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/API Keys/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const auth=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/auth.json","utf8")); console.log("APIKEY_AUTH_PRESENT="+Object.prototype.hasOwnProperty.call(auth,"apikey:${provider}")); console.log("APIKEY_ENV_AFTER="+(process.env["${envVar}"]||"missing"))'`,
    );
    await runtime.waitForScreenText(/APIKEY_AUTH_PRESENT=false/i, terminal, 8_000);
    await runtime.waitForScreenText(/APIKEY_ENV_AFTER=mc-e2e-real-env-key/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
