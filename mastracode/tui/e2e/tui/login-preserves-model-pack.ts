import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { anthropicOAuthProvider } from '@mastra/code-sdk/auth/providers/anthropic';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

const packName = 'Login Preserve E2E';
const packId = `custom:${packName}`;

/**
 * The `/login` command must not change the active model or model pack — that
 * only belongs to the onboarding flow. This exercises logging in to Anthropic
 * (whose post-login default is anthropic/claude-fable-5) while a custom pack is
 * active, and asserts the session keeps its custom build model.
 */
export const loginPreservesModelPackScenario = {
  name: 'login-preserves-model-pack',
  description: 'Logging in via /login keeps the active model pack instead of switching to the provider default.',
  testName: 'keeps the active model pack after logging in via /login',
  prepare({ appDataDir }) {
    rmSync(join(appDataDir, 'auth.json'), { force: true });
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      modePackId: packId,
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

    terminal.submit(
      `!node -e 'const fs=require("fs"); const app=process.env.MASTRA_APP_DATA_DIR; const s=JSON.parse(fs.readFileSync(app+"/settings.json","utf8")); const a=JSON.parse(fs.readFileSync(app+"/auth.json","utf8")); console.log("LOGIN_PRESERVE_AUTH="+(a.anthropic?.type||"missing")+":"+(a.anthropic?.access||"missing")); console.log("LOGIN_PRESERVE_PACK="+s.models.activeModelPackId); console.log("LOGIN_PRESERVE_DEFAULTS="+Object.keys(s.models.modeDefaults||{}).length);'`,
    );
    await runtime.waitForScreenText(/LOGIN_PRESERVE_AUTH=oauth:mc-login-preserve-access/i, terminal, 8_000);
    await runtime.waitForScreenText(/LOGIN_PRESERVE_PACK=custom:Login Preserve E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/LOGIN_PRESERVE_DEFAULTS=0/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
