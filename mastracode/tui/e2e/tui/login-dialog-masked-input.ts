import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { anthropicOAuthProvider } from '@mastra/code-sdk/auth/providers/anthropic';
import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

const secret = 'mc-login-mask-code-12345#state';
const secretHex = Buffer.from(secret, 'utf8').toString('hex');

export const loginDialogMaskedInputScenario = {
  name: 'login-dialog-masked-input',
  description: 'Exercises login-dialog masked prompt input through the real TUI.',
  testName: 'masks login prompt input while submitting the raw authorization code',
  prepare({ appDataDir, projectDir }) {
    rmSync(join(appDataDir, 'auth.json'), { force: true });
    mkdirSync(projectDir, { recursive: true });
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    patches.setProperty(anthropicOAuthProvider, 'login', async callbacks => {
      const code = await callbacks.onPrompt?.({
        message: 'Paste the masked login authorization code:',
        placeholder: 'mc-login-mask-code#state',
      });
      callbacks.onProgress?.('MC_LOGIN_MASK_CODE_LENGTH=' + String(code?.length ?? 0));
      return {
        access: 'access:' + code,
        refresh: 'refresh:' + code,
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

    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 8_000);
    terminal.submit('/login');

    await runtime.waitForScreenText(/Select provider to login:/i, terminal, 8_000);
    await runtime.waitForScreenText(/Anthropic \(Claude Pro\/Max\)/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Login to Anthropic \(Claude Pro\/Max\)/i, terminal, 8_000);
    await runtime.waitForScreenText(/Paste the masked login authorization code:/i, terminal, 8_000);

    terminal.write(secret);
    await runtime.waitForScreenText(/\*{30}/, terminal, 2_000);

    const maskedScreen = terminal.serialize().view;
    expect(maskedScreen).not.toContain(secret);
    expect(maskedScreen).toMatch(/\*{30}/);

    terminal.write('\r');
    await runtime.waitForScreenText(/Logged in to Anthropic/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const a=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/auth.json","utf8")); const expected=Buffer.from("${secretHex}","hex").toString("utf8"); console.log("LOGIN_MASK_AUTH="+(a.anthropic?.type=== "oauth")+":"+(a.anthropic?.access === "access:"+expected)+":"+(a.anthropic?.refresh === "refresh:"+expected));'`,
    );
    await runtime.waitForScreenText(/LOGIN_MASK_AUTH=true:true:true/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
