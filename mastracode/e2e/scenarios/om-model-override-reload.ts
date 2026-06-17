import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const providerName = 'OM Override E2E';
const providerId = 'om-override-e2e';
const seededObserver = `${providerId}/seed-observer`;
const seededReflector = `${providerId}/seed-reflector`;
const updatedObserver = `${providerId}/updated-observer`;
const updatedReflector = `${providerId}/updated-reflector`;

export const omModelOverrideReloadScenario: McE2eScenario = {
  name: 'om-model-override-reload',
  description: 'Restores and persists role-specific OM model overrides through the real TUI.',
  testName: 'restores and persists OM observer and reflector model overrides',
  skipReason: 'current main opens custom-provider API key prompt while selecting OM override models',
  useOpenAIModel: true,
  aimockFixture: 'om-model-override-reload.json',
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
        name: providerName,
        url: 'http://127.0.0.1:43434/v1',
        apiKey: 'sk-om-override-e2e',
        models: ['seed-observer', 'seed-reflector', 'updated-observer', 'updated-reflector'],
      },
    ];
    settings.models = {
      ...settings.models,
      activeOmPackId: 'custom',
      omModelOverride: null,
      observerModelOverride: seededObserver,
      reflectorModelOverride: seededReflector,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    writeFileSync(
      join(appDataDir, 'auth.json'),
      JSON.stringify({ [`apikey:${providerId}`]: { type: 'api_key', key: 'sk-om-override-e2e' } }, null, 2),
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('Create OM model override thread.');
    await runtime.waitForScreenText(/OM model override thread ready\./i, terminal, 12_000);

    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/Observer model\s+seed-observer/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflector model\s+seed-reflector/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Observer Model/i, terminal, 8_000);
    terminal.write(updatedObserver);
    await runtime.waitForScreenText(/updated-observer/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Observer model\s+updated-observer/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/Observer Model/, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Reflector Model/i, terminal, 8_000);
    terminal.write(updatedReflector);
    await runtime.waitForScreenText(/updated-reflector/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Reflector model\s+updated-reflector/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/Reflector Model/, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);

    terminal.submit('/om');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/Observer model\s+updated-observer/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflector model\s+updated-reflector/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const m=s.models||{}; console.log("OM_MODEL_PACK="+m.activeOmPackId); console.log("OM_MODEL_LEGACY="+(m.omModelOverride||"null")); console.log("OM_MODEL_OBSERVER="+m.observerModelOverride); console.log("OM_MODEL_REFLECTOR="+m.reflectorModelOverride);'`,
    );
    await runtime.waitForScreenText(/OM_MODEL_PACK=custom/i, terminal, 8_000);
    await runtime.waitForScreenText(/OM_MODEL_LEGACY=null/i, terminal, 8_000);
    await runtime.waitForScreenText(/OM_MODEL_OBSERVER=om-override-e2e\/updated-observer/i, terminal, 8_000);
    await runtime.waitForScreenText(/OM_MODEL_REFLECTOR=om-override-e2e\/updated-reflector/i, terminal, 8_000);

    terminal.submit(
      `!sqlite3 "$MASTRA_DB_PATH" "select 'OM_MODEL_THREAD=' || (instr(hex(metadata),'6F627365727665724D6F64656C4964')>0) || ':' || (instr(hex(metadata),'6F6D2D6F766572726964652D6532652F757064617465642D6F62736572766572')>0) || ':' || (instr(hex(metadata),'7265666C6563746F724D6F64656C4964')>0) || ':' || (instr(hex(metadata),'6F6D2D6F766572726964652D6532652F757064617465642D7265666C6563746F72')>0) from mastra_threads where instr(hex(metadata),'6F627365727665724D6F64656C4964')>0 limit 1"`,
    );
    await runtime.waitForScreenText(/OM_MODEL_THREAD=1:1:1:1/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected OM model override reload scenario to make 1 AIMock request, received ${requests.length}`);
    }
  },
};
