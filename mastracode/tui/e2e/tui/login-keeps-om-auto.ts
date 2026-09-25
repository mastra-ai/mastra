import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { openaiCodexOAuthProvider } from '@mastra/code-sdk/auth/providers/openai-codex';
import { createGlobalPatchScope } from './global-patches.js';
import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

export const loginKeepsOmAutoScenario = {
  name: 'login-keeps-om-auto',
  description: 'A successful provider login changes reachability only; OM roles stay auto.',
  testName: 'leaves auto observer and reflector intent unpinned after /login',
  prepare({ appDataDir }) {
    rmSync(join(appDataDir, 'auth.json'), { force: true });
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = readMutableSettingsFixture(settingsPath);
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      omPackId: null,
      quietModePreferenceSelected: true,
    };
    settings.models = {
      ...settings.models,
      activeOmPackId: null,
      omModelOverride: null,
      observerModelOverride: null,
      observerModelSelection: null,
      reflectorModelOverride: null,
      reflectorModelSelection: null,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    patches.setProperty(openaiCodexOAuthProvider, 'login', async callbacks => {
      callbacks.onProgress?.('MC_LOGIN_OM_AUTO_FAKE_LOGIN');
      return {
        access: 'mc-login-om-auto-access',
        refresh: 'mc-login-om-auto-refresh',
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

    terminal.submit('/login');
    await runtime.waitForScreenText(/Select provider to login:/i, terminal, 8_000);
    await runtime.waitForScreenText(/ChatGPT Plus\/Pro \(Codex Subscription\)/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/How do you want to sign in to ChatGPT Plus\/Pro/i, terminal, 8_000);
    terminal.write('\r');

    // Post-login account-name prompt: keep the default label.
    await runtime.waitForScreenText(/Name this account/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Successfully logged in to ChatGPT Plus\/Pro/i, terminal, 8_000);
    terminal.submit('/memory');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    // The login switched the main model to `openai/gpt-5.6-sol`, so auto roles
    // now resolve to the OpenAI low-cost OM pack.
    await runtime.waitForScreenText(/Observer model\s+Auto \(gpt-5\.4-mini\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflector model\s+Auto \(gpt-5\.4-mini\)/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const app=process.env.MASTRA_APP_DATA_DIR; const s=JSON.parse(fs.readFileSync(app+"/settings.json","utf8")); console.log("LOGIN_OM_AUTO="+s.onboarding.omPackId+":"+s.models.activeOmPackId+":"+(s.models.omModelOverride||"none")+":"+(s.models.observerModelSelection||"none"));'`,
    );
    await runtime.waitForScreenText(/LOGIN_OM_AUTO=null:null:none:none/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
