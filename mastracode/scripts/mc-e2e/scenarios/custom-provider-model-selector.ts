import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

const packName = 'Provider Selector E2E';
const planModel = 'selector-e2e/plan-select-e2e';
const buildModel = 'selector-e2e/build-select-e2e';
const fastModel = 'selector-e2e/fast-select-e2e';

async function selectModel(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime, title: RegExp, modelId: string) {
  await runtime.waitForScreenText(title, terminal, 8_000);
  await runtime.waitForScreenText(/Type to search/i, terminal, 8_000);
  terminal.write(modelId);
  await runtime.waitForScreenText(new RegExp(modelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), terminal, 8_000);
  const screen = terminal.serialize().view;
  if (screen.includes(`Use: ${modelId}`)) {
    throw new Error(`Expected ${modelId} to come from the custom provider catalog, not the free-form Use entry`);
  }
  terminal.write('\r');
}

export const customProviderModelSelectorScenario = {
  name: 'custom-provider-model-selector',
  description: 'creates a /models custom pack by selecting models from a configured OpenAI-compatible custom provider catalog',
  testName: 'selects custom-provider models in the /models custom pack flow and persists defaults',
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
    settings.customProviders = [
      {
        name: 'Selector E2E',
        url: 'http://127.0.0.1:43212/v1',
        apiKey: 'sk-selector-e2e',
        models: ['plan-select-e2e', 'build-select-e2e', 'fast-select-e2e'],
      },
    ];
    settings.customModelPacks = [];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
      subagentModels: { explore: 'stale-provider/stale-model' },
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

    await selectModel(terminal, runtime, /Select model for plan mode/i, planModel);
    await selectModel(terminal, runtime, /Select model for build mode/i, buildModel);
    await selectModel(terminal, runtime, /Select model for fast mode/i, fastModel);

    await runtime.waitForScreenText(/Switched to Provider Selector E2E pack/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const pack=s.customModelPacks.find(p=>p.name==="${packName}"); console.log("CUSTOM_PROVIDER_COUNT="+s.customProviders.length); console.log("CUSTOM_SELECTOR_ACTIVE="+s.models.activeModelPackId); console.log("CUSTOM_SELECTOR_PLAN="+s.models.modeDefaults.plan); console.log("CUSTOM_SELECTOR_BUILD="+s.models.modeDefaults.build); console.log("CUSTOM_SELECTOR_FAST="+s.models.modeDefaults.fast); console.log("CUSTOM_SELECTOR_PACK_PLAN="+pack.models.plan); console.log("CUSTOM_SELECTOR_PACK_BUILD="+pack.models.build); console.log("CUSTOM_SELECTOR_PACK_FAST="+pack.models.fast); console.log("CUSTOM_SELECTOR_SUBAGENTS="+Object.keys(s.models.subagentModels||{}).length);'`,
    );
    await runtime.waitForScreenText(/CUSTOM_PROVIDER_COUNT=1/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_SELECTOR_ACTIVE=custom:Provider Selector E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_SELECTOR_PLAN=selector-e2e\/plan-select-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_SELECTOR_BUILD=selector-e2e\/build-select-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_SELECTOR_FAST=selector-e2e\/fast-select-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_SELECTOR_PACK_PLAN=selector-e2e\/plan-select-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_SELECTOR_PACK_BUILD=selector-e2e\/build-select-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_SELECTOR_PACK_FAST=selector-e2e\/fast-select-e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_SELECTOR_SUBAGENTS=0/i, terminal, 8_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
} satisfies McE2eScenario;
