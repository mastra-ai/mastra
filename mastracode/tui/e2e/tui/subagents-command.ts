import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

const selectedModel = '302ai/subagent-config-e2e-model';

export const subagentsCommandScenario = {
  name: 'subagents-command',
  description: 'Enables, configures, and disables subagents through the /subagents TUI command.',
  testName: 'persists subagent enablement and model configuration from the TUI',
  env() {
    return { '302AI_API_KEY': 'sk-subagent-config-e2e' };
  },
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.preferences = {
      ...settings.preferences,
      subagentsEnabled: false,
    };
    settings.models = {
      ...settings.models,
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);

    terminal.submit('/subagents');
    await runtime.waitForScreenText(/Manage subagents/i, terminal);
    await runtime.waitForScreenText(/Enable subagents/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Subagents enabled\. Restart MastraCode for this to take effect\./i, terminal);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("SUBAGENTS_ENABLED="+s.preferences.subagentsEnabled);'`,
    );
    await runtime.waitForScreenText(/SUBAGENTS_ENABLED=true/i, terminal, 8_000);

    terminal.submit('/subagents');
    await runtime.waitForScreenText(/Disable subagents/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Select subagent type/i, terminal);
    await runtime.waitForScreenText(/Explore/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Select scope for Explore subagents/i, terminal);
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/Select subagent model \(Explore · Global\)/i, terminal);
    await runtime.waitForScreenText(/Type to search/i, terminal);
    terminal.write(selectedModel);
    await runtime.waitForScreenText(/Use: 302ai\/subagent-config-e2e-model/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(
      /Subagent model set for Explore · Global: 302ai\/subagent-config-e2e-model/i,
      terminal,
      8_000,
    );

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("SUBAGENT_EXPLORE_MODEL="+(s.models.subagentModels.explore||"missing"));'`,
    );
    await runtime.waitForScreenText(/SUBAGENT_EXPLORE_MODEL=302ai\/subagent-config-e2e-model/i, terminal, 8_000);

    terminal.submit('/subagents');
    await runtime.waitForScreenText(/Disable subagents/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Subagents disabled\. Restart MastraCode for this to take effect\./i, terminal);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("SUBAGENTS_ENABLED_AFTER_DISABLE="+s.preferences.subagentsEnabled);'`,
    );
    await runtime.waitForScreenText(/SUBAGENTS_ENABLED_AFTER_DISABLE=false/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
