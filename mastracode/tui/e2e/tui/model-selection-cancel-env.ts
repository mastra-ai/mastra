import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const packName = 'Cancel Env Selection E2E';
const envModel = '302ai/env-precedence-e2e-model';
const cancelModel = 'cancel-only/cancelled-key-e2e-model';
const realEnvKey = 'sk-real-env-selection-e2e';

export const modelSelectionCancelEnvScenario = {
  name: 'model-selection-cancel-env',
  description: 'selects an env-backed model without prompting and preserves missing-key cancellation semantics',
  testName: 'skips model-selection key prompt for env keys and preserves cancelled missing-key selection',
  env() {
    return {
      '302AI_API_KEY': realEnvKey,
    };
  },
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
    settings.customModelPacks = [
      {
        name: packName,
        models: {
          plan: 'anthropic/claude-sonnet-4-5',
          build: 'anthropic/claude-sonnet-4-5',
          fast: 'anthropic/claude-sonnet-4-5',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
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
    await runtime.waitForScreenText(/Cancel Env Selection E2E/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Custom pack: Cancel Env Selection E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Edit\s+Update this pack/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Edit custom pack: Cancel Env Selection E2E/i, terminal, 8_000);

    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Select model for plan mode/i, terminal, 8_000);
    terminal.write(envModel);
    await runtime.waitForScreenText(/Use: 302ai\/env-precedence-e2e-model/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Edit custom pack: Cancel Env Selection E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/302ai\/env-precedence-e2e-model/i, terminal, 8_000);

    terminal.write('\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Select model for build mode/i, terminal, 8_000);
    terminal.write(cancelModel);
    await runtime.waitForScreenText(/Use: cancel-only\/cancelled-key-e2e-model/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/API Key Required/i, terminal, 8_000);
    await runtime.waitForScreenText(/Enter an API key for cancel-only:/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Edit custom pack: Cancel Env Selection E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/cancel-only\/cancelled-key-e2e-model/i, terminal, 8_000);

    terminal.write('\x1b[B\x1b[B\x1b[B\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/302ai\/env-precedence-e2e-model/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Switch model pack/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const authPath=process.env.MASTRA_APP_DATA_DIR+"/auth.json"; const settings=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const auth=fs.existsSync(authPath) ? JSON.parse(fs.readFileSync(authPath,"utf8")) : {}; const pack=settings.customModelPacks.find(p=>p.name==="${packName}"); console.log("MODEL_CANCEL_PLAN="+pack.models.plan); console.log("MODEL_CANCEL_BUILD="+pack.models.build); console.log("MODEL_CANCEL_302_KEY="+(auth["apikey:302ai"]?.key || "missing")); console.log("MODEL_CANCEL_CANCEL_KEY="+(auth["apikey:cancel-only"]?.key || "missing"));'`,
    );
    await runtime.waitForScreenText(/MODEL_CANCEL_PLAN=302ai\/env-precedence-e2e-model/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODEL_CANCEL_BUILD=cancel-only\/cancelled-key-e2e-model/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODEL_CANCEL_302_KEY=missing/i, terminal, 8_000);
    await runtime.waitForScreenText(/MODEL_CANCEL_CANCEL_KEY=missing/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
