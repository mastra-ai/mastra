import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { anthropicOAuthProvider } from '@mastra/code-sdk/auth/providers/anthropic';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

export const setupLoginRefreshScenario = {
  name: 'setup-login-refresh',
  description: 'Refreshes onboarding model packs after a successful login without restarting the TUI.',
  testName: 'refreshes available setup packs after login succeeds',
  prepare({ appDataDir, projectDir }) {
    rmSync(join(appDataDir, 'settings.json'), { force: true });
    rmSync(join(appDataDir, 'auth.json'), { force: true });
    mkdirSync(projectDir, { recursive: true });
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    patches.setProperty(anthropicOAuthProvider, 'login', async callbacks => {
      callbacks.onProgress?.('MC_SETUP_LOGIN_REFRESH_FAKE_LOGIN');
      return {
        access: 'mc-setup-login-refresh-access',
        refresh: 'mc-setup-login-refresh-refresh',
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
      GOOGLE_GENERATIVE_AI_API_KEY: '',
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

    const modelPackScreen = terminal.serialize().view;
    if (/No model providers configured/i.test(modelPackScreen)) {
      throw new Error('Expected provider-access warning to clear after successful login refresh');
    }

    terminal.write('\r');

    await runtime.waitForScreenText(/Observational Memory/i, terminal, 8_000);
    await runtime.waitForScreenText(/Claude Haiku\s+Via Max subscription/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Tool Approval/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 8_000);
    await runtime.waitForScreenText(/anthropic\/claude-fable-5/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const app=process.env.MASTRA_APP_DATA_DIR; const s=JSON.parse(fs.readFileSync(app+"/settings.json","utf8")); const a=JSON.parse(fs.readFileSync(app+"/auth.json","utf8")); console.log("SETUP_LOGIN_AUTH="+(a.anthropic?.type||"missing")+":"+(a.anthropic?.access||"missing")); console.log("SETUP_LOGIN_PACK="+s.models.activeModelPackId+":"+s.onboarding.modePackId+":"+s.onboarding.omPackId+":"+s.models.activeOmPackId); console.log("SETUP_LOGIN_BUILTIN_DEFAULTS="+Object.keys(s.models.modeDefaults||{}).length);'`,
    );
    await runtime.waitForScreenText(/SETUP_LOGIN_AUTH=oauth:mc-setup-login-refresh-access/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_LOGIN_PACK=anthropic:anthropic:anthropic:anthropic/i, terminal, 8_000);
    await runtime.waitForScreenText(/SETUP_LOGIN_BUILTIN_DEFAULTS=0/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
