import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { anthropicOAuthProvider } from '@mastra/code-sdk/auth/providers/anthropic';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

/**
 * Gemini is reachable from an API key before the wizard starts, so it heads the
 * OM list; the Anthropic login must still win the preselection.
 */
export const onboardingOmFollowsLoginScenario = {
  name: 'onboarding-om-follows-login',
  description: 'Preselects the OM pack of the provider signed in during onboarding, not the first reachable one.',
  testName: 'preselects the OM pack matching the provider signed in during setup',
  prepare({ appDataDir, projectDir }) {
    rmSync(join(appDataDir, 'settings.json'), { force: true });
    rmSync(join(appDataDir, 'auth.json'), { force: true });
    mkdirSync(projectDir, { recursive: true });
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    patches.setProperty(anthropicOAuthProvider, 'login', async callbacks => {
      callbacks.onProgress?.('MC_ONBOARDING_OM_FOLLOWS_LOGIN_FAKE_LOGIN');
      return {
        access: 'mc-onboarding-om-follows-login-access',
        refresh: 'mc-onboarding-om-follows-login-refresh',
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
  env() {
    return {
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      MASTRA_GATEWAY_API_KEY: '',
      GOOGLE_GENERATIVE_AI_API_KEY: 'mc-e2e-google-key',
      GOOGLE_API_KEY: '',
      DEEPSEEK_API_KEY: '',
      CEREBRAS_API_KEY: '',
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Welcome to Mastra Code/i, terminal);
    terminal.write('\r');

    await runtime.waitForScreenText(/Authentication/i, terminal, 8_000);
    await runtime.waitForScreenText(/Anthropic \(Claude Pro\/Max\)/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Model Packs/i, terminal, 8_000);
    await runtime.waitForScreenText(/Anthropic\s+All Anthropic models via Max subscription/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Observational Memory/i, terminal, 8_000);
    await runtime.waitForScreenText(/Gemini Flash\s+Via Google API key/i, terminal, 8_000);
    await runtime.waitForScreenText(/Claude Haiku\s+Via Max subscription/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Tool Approval/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 8_000);

    terminal.submit('/memory');
    await runtime.waitForScreenText(/Observational Memory Settings/i, terminal, 8_000);
    await runtime.waitForScreenText(/Observer model\s+claude-haiku-4-5/i, terminal, 8_000);
    await runtime.waitForScreenText(/Reflector model\s+claude-haiku-4-5/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Observational Memory Settings/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const app=process.env.MASTRA_APP_DATA_DIR; const s=JSON.parse(fs.readFileSync(app+"/settings.json","utf8")); console.log("ONBOARDING_OM_PACK="+s.onboarding.omPackId+":"+s.models.activeOmPackId);'`,
    );
    await runtime.waitForScreenText(/ONBOARDING_OM_PACK=anthropic:anthropic/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
