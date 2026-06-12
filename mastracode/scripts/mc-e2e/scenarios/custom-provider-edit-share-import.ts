import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const providerName = 'Share Edit E2E';
const providerId = 'share-edit-e2e';
const packName = 'Share Cancel E2E';
const pack = {
  name: packName,
  models: {
    plan: `${providerId}/plan-model`,
    build: `${providerId}/build-model`,
    fast: `${providerId}/fast-model`,
  },
};
const sharedPackString = `mastra-pack:${Buffer.from(JSON.stringify(pack), 'utf8').toString('base64')}`;

export const customProviderEditShareImportScenario = {
  name: 'custom-provider-edit-share-import',
  description: 'edits a custom provider and exercises custom pack share plus import cancel through real TUI modals',
  testName: 'edits a custom provider and cancels importing a shared pack collision',
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
        url: 'http://127.0.0.1:43210/v1',
        apiKey: 'sk-share-edit-original',
        models: ['plan-model', 'build-model', 'fast-model'],
      },
    ];
    settings.customModelPacks = [
      {
        ...pack,
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = {
      ...settings.models,
      activeModelPackId: null,
      modeDefaults: {},
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    const submitOverDefault = (value: string) => {
      terminal.write('\x1b[3~'.repeat(80));
      terminal.write(`${value}\r`);
    };

    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    await runtime.waitForScreenText(/Share Cancel E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Import Pack/i, terminal, 8_000);

    terminal.write('\r');
    await runtime.waitForScreenText(/Custom pack: Share Cancel E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Share\s+Copy to clipboard/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Copie/i, terminal, 8_000);

    terminal.write('\x1b');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    terminal.write('\x1b');
    await runtime.sleep(300);
    terminal.submit(
      `!node -e 'const cp=require("child_process"); const raw=cp.execFileSync("pbpaste",[],{encoding:"utf8"}).trim(); const prefix="mastra-pack:"; const decoded=raw.startsWith(prefix)?JSON.parse(Buffer.from(raw.slice(prefix.length),"base64").toString("utf8")):{models:{}}; console.log("PACK_CLIPBOARD_NAME="+(decoded.name||"missing")); console.log("PACK_CLIPBOARD_MODELS="+[decoded.models?.plan,decoded.models?.build,decoded.models?.fast].join("|"));'`,
    );
    await runtime.waitForScreenText(/PACK_CLIPBOARD_NAME=Share Cancel E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /PACK_CLIPBOARD_MODELS=share-edit-e2e\/plan-model\|share-edit-e2e\/build-model\|share-edit-e2e\/fast-model/i,
      terminal,
      8_000,
    );

    terminal.submit('/models');
    await runtime.waitForScreenText(/Switch model pack/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Paste the shared model pack string/i, terminal, 8_000);
    terminal.write(sharedPackString);
    terminal.write('\r');
    await runtime.waitForScreenText(/A pack named "Share Cancel E2E" already exists/i, terminal, 8_000);
    await runtime.waitForScreenText(/Cancel\s+Abort import/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');

    terminal.submit('/custom-providers');
    await runtime.waitForScreenText(/Custom providers/i, terminal, 8_000);
    await runtime.waitForScreenText(/Share Edit E2E/i, terminal, 8_000);
    terminal.write('\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');
    await runtime.waitForScreenText(/Manage provider: Share Edit E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/Edit provider/i, terminal, 8_000);
    terminal.write('\x1b[B\x1b[B');
    await runtime.sleep(200);
    terminal.write('\r');

    await runtime.waitForScreenText(/Provider name/i, terminal, 8_000);
    submitOverDefault('Share Edited E2E');
    await runtime.waitForScreenText(/Base URL/i, terminal, 8_000);
    submitOverDefault('http://127.0.0.1:43299/v1');
    await runtime.waitForScreenText(/API key/i, terminal, 8_000);
    submitOverDefault('sk-share-edit-updated');
    await runtime.waitForScreenText(/Updated custom provider: Share Edited E2E/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const p=s.customProviders[0]; const pack=s.customModelPacks[0]; console.log("CUSTOM_EDIT_PROVIDER="+[p.name,p.url,p.apiKey].join("|")); console.log("CUSTOM_EDIT_MODELS="+p.models.join("|")); console.log("CUSTOM_PACK_COUNT="+s.customModelPacks.length); console.log("CUSTOM_PACK_NAME="+pack.name); console.log("CUSTOM_IMPORT_ACTIVE="+s.models.activeModelPackId);'`,
    );
    await runtime.waitForScreenText(
      /CUSTOM_EDIT_PROVIDER=Share Edited E2E\|http:\/\/127\.0\.0\.1:43299\/v1\|sk-share-edit-updated/i,
      terminal,
      8_000,
    );
    await runtime.waitForScreenText(/CUSTOM_EDIT_MODELS=plan-model\|build-model\|fast-model/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_PACK_COUNT=1/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_PACK_NAME=Share Cancel E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(/CUSTOM_IMPORT_ACTIVE=null/i, terminal, 8_000);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
} satisfies McE2eScenario;
