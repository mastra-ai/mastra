import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

export const bedrockModelDiscoveryScenario = {
  name: 'bedrock-model-discovery',
  description: 'Bedrock model selection excludes transport overrides while retaining Converse siblings.',
  testName: 'offers only Converse-compatible Bedrock catalog entries in the model picker',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
    };
    settings.customModelPacks = [
      {
        name: 'Bedrock Discovery',
        models: {
          plan: 'amazon-bedrock/openai.gpt-oss-120b-1:0',
          build: 'amazon-bedrock/openai.gpt-oss-120b-1:0',
          fast: 'amazon-bedrock/openai.gpt-oss-120b-1:0',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = { ...settings.models, activeModelPackId: 'custom:Bedrock Discovery', modeDefaults: {} };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    patches.setEnv('AWS_ACCESS_KEY_ID', 'bedrock-discovery-test');
    patches.setEnv('AWS_SECRET_ACCESS_KEY', 'bedrock-discovery-test');
    patches.setEnv('AWS_REGION', 'us-east-1');
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === 'https://models.dev/api.json') {
        return Response.json({
          'amazon-bedrock': {
            models: {
              'openai.gpt-oss-120b-1:0': {},
              'openai.gpt-oss-120b': { provider: { shape: 'responses' } },
              'xai.grok-4.6': { provider: { npm: '@ai-sdk/amazon-bedrock/mantle' } },
            },
          },
        });
      }
      return originalFetch(input, init);
    });
    try {
      const app = await startMastraCodeApp({
        config: { disableHooks: true, disableMcp: true, unixSocketPubSub: false },
      });
      return { stop: () => patches.stopApp(app.stop) };
    } catch (error) {
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Resource ID:/i, terminal);
    terminal.submit('/model');
    await runtime.waitForScreenText(/Select Model/i, terminal, 8_000);
    terminal.write('amazon-bedrock');
    await runtime.waitForScreenText(/amazon-bedrock\/openai\.gpt-oss-120b-1:0/, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/amazon-bedrock\/openai\.gpt-oss-120b(?!-1:0)/, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/amazon-bedrock\/xai\.grok-4\.6/, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched build mode to amazon-bedrock\/openai\.gpt-oss-120b-1:0/, terminal, 8_000);
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
