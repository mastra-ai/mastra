import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { anthropicOAuthProvider } from '@mastra/code-sdk/auth/providers/anthropic';
import { createGlobalPatchScope } from './global-patches.js';
import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

const packName = 'Login Preserve E2E';
const packId = `custom:${packName}`;

/**
 * `/login` authenticates a provider without replacing existing model choices.
 */
export const loginPreservesModelPackScenario = {
  name: 'login-preserves-model-pack',
  description: 'Logging in via /login preserves the active model and OM packs.',
  testName: 'keeps explicit model and OM choices after logging in via /login',
  prepare({ appDataDir }) {
    rmSync(join(appDataDir, 'auth.json'), { force: true });
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = readMutableSettingsFixture(settingsPath);
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      modePackId: packId,
      omPackId: 'custom',
      quietModePreferenceSelected: true,
    };
    settings.customModelPacks = [
      {
        name: packName,
        models: {
          plan: 'login-preserve-e2e/plan-model',
          build: 'login-preserve-e2e/build-model',
          fast: 'login-preserve-e2e/fast-model',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: packId,
      modeDefaults: {},
      activeOmPackId: 'custom',
      omModelOverride: 'login-preserve-e2e/om-model',
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    patches.setProperty(anthropicOAuthProvider, 'login', async callbacks => {
      callbacks.onProgress?.('MC_LOGIN_PRESERVE_FAKE_LOGIN');
      return {
        access: 'mc-login-preserve-access',
        refresh: 'mc-login-preserve-refresh',
        expires: Date.now() + 60 * 60 * 1000,
      };
    });

    try {
      const app = await startMastraCodeApp();
      return { stop: () => patches.stopApp(app.stop) };
    } catch (error) {
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    await runtime.waitForScreenText(/▐build▌login-preserve-e2e\/build-model/i, terminal, 8_000);

    terminal.submit('/login');
    await runtime.waitForScreenText(/Select provider to login:/i, terminal, 8_000);
    await runtime.waitForScreenText(/Anthropic \(Claude Pro\/Max\)/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Logged in to Anthropic/i, terminal, 8_000);

    // The active model pack must survive login: the status line still shows the
    // custom build model, and the login never switched to the provider default.
    await runtime.waitForScreenText(/▐build▌login-preserve-e2e\/build-model/i, terminal, 8_000);
    await runtime.waitForScreenTextAbsent(/claude-fable-5/i, terminal, 4_000);
    await runtime.waitForScreenTextAbsent(/switched to anthropic/i, terminal, 4_000);

    terminal.submit('/memory');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/Observer model\s+om-model/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflector model\s+om-model/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const app=process.env.MASTRA_APP_DATA_DIR; const s=JSON.parse(fs.readFileSync(app+"/settings.json","utf8")); const a=JSON.parse(fs.readFileSync(app+"/auth.json","utf8")); console.log("LOGIN_PRESERVE_AUTH="+(a.anthropic?.type||"missing")+":"+(a.anthropic?.access||"missing")); console.log("LOGIN_PRESERVE_PACK="+s.models.activeModelPackId); console.log("LOGIN_PRESERVE_OM="+s.onboarding.omPackId+":"+s.models.activeOmPackId+":"+s.models.omModelOverride); console.log("LOGIN_PRESERVE_DEFAULTS="+Object.keys(s.models.modeDefaults||{}).length);'`,
    );
    await runtime.waitForScreenText(/LOGIN_PRESERVE_AUTH=oauth:mc-login-preserve-access/i, terminal, 8_000);
    await runtime.waitForScreenText(/LOGIN_PRESERVE_PACK=custom:Login Preserve E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/LOGIN_PRESERVE_OM=custom:custom:login-preserve-e2e\/om-model/i, terminal, 8_000);
    await runtime.waitForScreenText(/LOGIN_PRESERVE_DEFAULTS=0/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
