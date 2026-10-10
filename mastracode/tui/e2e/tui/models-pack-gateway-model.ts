import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

const packName = 'Kimi Gateway E2E';
const modelId = 'kimi-for-coding/k3';

async function selectModel(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime, title: RegExp) {
  await runtime.waitForScreenText(title, terminal, 8_000);
  await runtime.waitForScreenText(/Type to search/i, terminal, 8_000);
  terminal.write(modelId);
  await runtime.waitForScreenText(/→ kimi-for-coding\/k3/i, terminal, 8_000);
  const screen = terminal.serialize().view;
  if (screen.includes(`Use: ${modelId}`) || screen.includes(`mastracode/${modelId}`)) {
    throw new Error(`Expected ${modelId} to be listed under its canonical id, not the gateway-namespaced or Use entry`);
  }
  terminal.write('\r');
}

export const modelsPackGatewayModelScenario = {
  name: 'models-pack-gateway-model',
  description:
    'Creates a /models custom pack by typing a MastraCode gateway model id (Kimi For Coding) and verifies it autocompletes and persists without the mastracode/ prefix.',
  testName: 'selects kimi-for-coding/k3 from the catalog and saves the canonical id',
  env: () => ({
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    GOOGLE_GENERATIVE_AI_API_KEY: '',
    GOOGLE_API_KEY: '',
    MASTRA_GATEWAY_API_KEY: '',
    KIMI_API_KEY: 'sk-kimi-gateway-e2e',
  }),
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
    };
    settings.customModelPacks = [];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Custom\s+Choose a model for each mode/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Name this custom pack/i, terminal, 8_000);
    terminal.write(packName);
    terminal.write('\r');

    await selectModel(terminal, runtime, /Select model for plan mode/i);
    await selectModel(terminal, runtime, /Select model for build mode/i);
    await selectModel(terminal, runtime, /Select model for fast mode/i);

    await runtime.waitForScreenText(/Observational memory model \(optional\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Skip — use \/om settings/i, terminal, 8_000);
    // Third row is "Skip — use /om settings".
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to Kimi Gateway E2E pack/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const p=s.customModelPacks.find(p=>p.name==="${packName}"); console.log("GATEWAY_PACK_MODELS="+[p.models.plan,p.models.build,p.models.fast].join(",")); console.log("GATEWAY_DEFAULT_BUILD="+s.models.modeDefaults.build);'`,
    );
    await runtime.waitForScreenText(
      /GATEWAY_PACK_MODELS=kimi-for-coding\/k3,kimi-for-coding\/k3,kimi-for-coding\/k3/i,
      terminal,
      8_000,
    );
    await runtime.waitForScreenText(/GATEWAY_DEFAULT_BUILD=kimi-for-coding\/k3/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
