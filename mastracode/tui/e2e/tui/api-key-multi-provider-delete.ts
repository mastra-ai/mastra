import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

const firstProvider = '302ai';
const secondProvider = 'anthropic';
const firstEnvVar = '302AI_API_KEY';
const secondEnvVar = 'ANTHROPIC_API_KEY';
const firstStoredKey = 'mc-e2e-302ai-delete-isolation-key';
const secondStoredKey = 'mc-e2e-anthropic-preserved-key';

export const apiKeyMultiProviderDeleteScenario = {
  name: 'api-key-multi-provider-delete',
  description: 'Deletes only the selected stored provider key from a long provider list.',
  testName: 'deletes one stored key without affecting another provider',
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
          [`apikey:${firstProvider}`]: {
            type: 'api_key',
            key: firstStoredKey,
          },
          [`apikey:${secondProvider}`]: {
            type: 'api_key',
            key: secondStoredKey,
          },
        },
        null,
        2,
      ),
    );
  },
  env() {
    return {
      [firstEnvVar]: '',
      [secondEnvVar]: '',
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/api-keys');
    await runtime.waitForScreenText(/API Keys/i, terminal, 8_000);
    await runtime.waitForScreenText(/302ai\s+✓ \(stored\)/i, terminal, 8_000);

    terminal.write('\x7f');
    await runtime.waitForScreenText(/302ai\s+✗ \(not set\)/i, terminal, 8_000);

    const providerCountMatch = terminal.serialize().view.match(/\(\d+\/(\d+)\)/);
    if (!providerCountMatch) throw new Error('Expected /api-keys to show the provider count');

    const secondProviderStatus = /anthropic\s+✓ \(stored\)/i;
    const providerCount = Number(providerCountMatch[1]);
    for (let index = 0; index < providerCount && !secondProviderStatus.test(terminal.serialize().view); index += 1) {
      terminal.write('\x1b[B');
      await terminal.flushInput?.();
    }
    await runtime.waitForScreenText(secondProviderStatus, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/API Keys/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const auth=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/auth.json","utf8")); console.log("APIKEY_MULTI_302_AUTH="+(auth["apikey:${firstProvider}"]?.key||"missing")); console.log("APIKEY_MULTI_302_ENV="+(process.env["${firstEnvVar}"]||"missing")); console.log("APIKEY_MULTI_ANTHROPIC_AUTH="+(auth["apikey:${secondProvider}"]?.key||"missing")); console.log("APIKEY_MULTI_ANTHROPIC_ENV="+(process.env["${secondEnvVar}"]||"missing"));'`,
    );
    await runtime.waitForScreenText(/APIKEY_MULTI_302_AUTH=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/APIKEY_MULTI_302_ENV=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/APIKEY_MULTI_ANTHROPIC_AUTH=mc-e2e-anthropic-preserved-key/i, terminal, 8_000);
    await runtime.waitForScreenText(/APIKEY_MULTI_ANTHROPIC_ENV=mc-e2e-anthropic-preserved-key/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
