import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { anthropicOAuthProvider } from '@mastra/code-sdk/auth/providers/anthropic';
import { createGlobalPatchScope } from './global-patches.js';
import { readMutableSettingsFixture } from './settings-fixture.js';
import type { McE2eScenario } from './types.js';

/**
 * `/login` on a connected provider manages a multi-account registry:
 * add another account, verify labels/active marker, remove an account,
 * and the registry persists on disk with the right active account.
 */
export const multiAccountLoginScenario = {
  name: 'multi-account-login',
  description: 'Manages multiple OAuth accounts per provider through /login.',
  testName: 'adds, lists, and removes provider accounts through the /login account manager',
  prepare({ appDataDir, projectDir }) {
    rmSync(join(appDataDir, 'auth.json'), { force: true });
    const settings = readMutableSettingsFixture(join(appDataDir, 'settings.json'));
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
    };
    settings.customModelPacks = [];
    settings.customProviders = [];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
      subagentModels: {},
    };
    writeFileSync(join(appDataDir, 'settings.json'), JSON.stringify(settings, null, 2));
    mkdirSync(projectDir, { recursive: true });
  },
  async inProcessApp({ startMastraCodeApp }) {
    const patches = createGlobalPatchScope();
    let loginCalls = 0;
    patches.setProperty(anthropicOAuthProvider, 'login', async callbacks => {
      loginCalls += 1;
      callbacks.onProgress?.(`MC_MULTI_ACCOUNT_LOGIN_CALL_${loginCalls}`);
      if (loginCalls === 1) {
        return { access: 'mc-multi-a-access', refresh: 'mc-multi-a-refresh', expires: Date.now() + 60 * 60 * 1000 };
      }
      if (loginCalls === 2) {
        return { access: 'mc-multi-b-access', refresh: 'mc-multi-b-refresh', expires: Date.now() + 60 * 60 * 1000 };
      }
      // Third call: re-authentication of account A — providers rotate refresh
      // tokens per authorization, so this returns a fresh token set.
      return { access: 'mc-multi-a2-access', refresh: 'mc-multi-a2-refresh', expires: Date.now() + 60 * 60 * 1000 };
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
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    // First login on a fresh provider: normal flow + account-name prompt.
    terminal.submit('/login');
    await runtime.waitForScreenText(/Select provider to login:/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Name this account/i, terminal, 8_000);
    terminal.write('Account A');
    terminal.write('\r');
    await runtime.waitForScreenText(/Logged in to Anthropic/i, terminal, 8_000);

    // Second /login: selector shows the account count, selection opens the manager.
    terminal.submit('/login');
    await runtime.waitForScreenText(/Select provider to login:/i, terminal, 8_000);
    await runtime.waitForScreenText(/\(1 account\)/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Anthropic \(Claude Pro\/Max\) accounts/i, terminal, 8_000);
    await runtime.waitForScreenText(/Account A/i, terminal, 8_000);
    await runtime.waitForScreenText(/Add another account/i, terminal, 8_000);

    // Rows: [Account A, Add another account, Re-authenticate…, Remove…, Back].
    terminal.write('\x1b[B');
    await runtime.waitForScreenText(/→ Add another account/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Name this account/i, terminal, 8_000);
    terminal.write('Account B');
    terminal.write('\r');

    // The manager reopens after the add — and the new account is NOT
    // activated: Account A keeps the active marker.
    await runtime.waitForScreenText(/Anthropic \(Claude Pro\/Max\) accounts/i, terminal, 8_000);
    await runtime.waitForScreenText(/Account A\s*✓ active/i, terminal, 8_000);
    await runtime.waitForScreenText(/Account B/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Add another account/i, terminal, 8_000);

    // On disk: two accounts, A still active, slot still holds A's tokens.
    terminal.submit(
      `!node -e 'const fs=require("fs"); const a=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/auth.json","utf8")); const keys=Object.keys(a).filter(k=>k.startsWith("accounts:anthropic:")); console.log("ADD_COUNT="+keys.length); console.log("ADD_ACTIVE="+keys.map(k=>a[k].label+":"+a[k].active).join(",")); console.log("ADD_SLOT_ACCESS="+(a.anthropic&&a.anthropic.access));'`,
    );
    await runtime.waitForScreenText(/ADD_COUNT=2/i, terminal, 8_000);
    await runtime.waitForScreenText(/ADD_ACTIVE=Account A:true,Account B:false/i, terminal, 8_000);
    await runtime.waitForScreenText(/ADD_SLOT_ACCESS=mc-multi-a-access/i, terminal, 8_000);

    // Activate Account B from the manager.
    terminal.submit('/login');
    await runtime.waitForScreenText(/\(2 accounts\)/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Account A\s*✓ active/i, terminal, 8_000);
    terminal.write('\x1b[B');
    await runtime.waitForScreenText(/→ Account B/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched Anthropic \(Claude Pro\/Max\) to Account B/i, terminal, 8_000);

    // Re-authenticate account A in place: fresh tokens (rotated refresh
    // token) must replace A's entry — same label, same position, now active —
    // without appending a third account.
    terminal.submit('/login');
    await runtime.waitForScreenText(/\(2 accounts\)/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Account B\s*✓ active/i, terminal, 8_000);
    // Rows: [Account A, Account B, Add another, Re-authenticate…, Remove…, Back].
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    await runtime.waitForScreenText(/→ Re-authenticate…/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Select the account to re-authenticate:/i, terminal, 8_000);
    terminal.write('\r'); // Account A is the first row
    await runtime.waitForScreenText(/Name this account/i, terminal, 8_000);
    // The placeholder names Account A — the picked account, not a fresh append.
    await runtime.waitForScreenText(/Enter to keep "Account A"/i, terminal, 8_000);
    terminal.write('\r'); // keep the "Account A" label
    await runtime.waitForScreenText(/Logged in to Anthropic/i, terminal, 8_000);

    // Registry on disk after re-auth: two entries, A re-keyed to the new
    // refresh token and active with its label preserved, slot holds A's new
    // tokens.
    terminal.submit(
      `!node -e 'const fs=require("fs"); const a=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/auth.json","utf8")); const keys=Object.keys(a).filter(k=>k.startsWith("accounts:anthropic:")); const reAuth=keys.find(k=>a[k].label==="Account A"); console.log("REAUTH_COUNT="+keys.length); console.log("REAUTH_REFRESH="+(reAuth?a[reAuth].refresh:"missing")); console.log("REAUTH_ACTIVE="+(reAuth?a[reAuth].active:"missing")); console.log("REAUTH_SLOT_ACCESS="+(a.anthropic&&a.anthropic.access));'`,
    );
    await runtime.waitForScreenText(/REAUTH_COUNT=2/i, terminal, 8_000);
    await runtime.waitForScreenText(/REAUTH_REFRESH=mc-multi-a2-refresh/i, terminal, 8_000);
    await runtime.waitForScreenText(/REAUTH_ACTIVE=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/REAUTH_SLOT_ACCESS=mc-multi-a2-access/i, terminal, 8_000);

    // Remove the re-authenticated account A.
    terminal.submit('/login');
    await runtime.waitForScreenText(/\(2 accounts\)/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Account A\s*✓ active/i, terminal, 8_000);

    // Rows: [Account A, Account B, Add another, Re-authenticate…, Remove…, Back].
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    await runtime.waitForScreenText(/→ Remove…/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Select the account to remove:/i, terminal, 8_000);
    await runtime.waitForScreenText(/→ Account A/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Remove "Account A"\?/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Removed Account A from Anthropic/i, terminal, 8_000);

    // Registry on disk: exactly one anthropic account left, B active, slot holds B's tokens.
    terminal.submit(
      `!node -e 'const fs=require("fs"); const a=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/auth.json","utf8")); const keys=Object.keys(a).filter(k=>k.startsWith("accounts:anthropic:")); const rec=a[keys[0]]; console.log("MULTI_ACCOUNT_COUNT="+keys.length); console.log("MULTI_ACCOUNT_LABEL="+rec.label); console.log("MULTI_ACCOUNT_ACTIVE="+rec.active); console.log("MULTI_ACCOUNT_REFRESH="+rec.refresh); console.log("MULTI_SLOT_ACCESS="+(a.anthropic&&a.anthropic.access));'`,
    );
    await runtime.waitForScreenText(/MULTI_ACCOUNT_COUNT=1/i, terminal, 8_000);
    await runtime.waitForScreenText(/MULTI_ACCOUNT_LABEL=Account B/i, terminal, 8_000);
    await runtime.waitForScreenText(/MULTI_ACCOUNT_ACTIVE=true/i, terminal, 8_000);
    await runtime.waitForScreenText(/MULTI_ACCOUNT_REFRESH=mc-multi-b-refresh/i, terminal, 8_000);
    await runtime.waitForScreenText(/MULTI_SLOT_ACCESS=mc-multi-b-access/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
