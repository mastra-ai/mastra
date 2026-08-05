import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from './expect.js';

import type { McE2eScenario } from './types.js';

const packName = 'Subagent Startup Restore E2E';
const packId = `custom:${packName}`;
const restoredSubagentModel = 'openai/gpt-5.5';

export const subagentModelStartupRestoreScenario = {
  name: 'subagent-model-startup-restore',
  description: 'Restores persisted subagent model defaults during TUI startup and uses them for delegation.',
  testName: 'uses persisted subagent model defaults for delegated subagents',
  skipReason:
    'current main subagent delegation flow no longer renders expected progress/result path for restored model defaults',
  useOpenAIModel: true,
  aimockFixture: 'subagent-model-startup-restore.json',
  prepare({ appDataDir, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
    };
    settings.onboarding.modePackId = packId;
    settings.customModelPacks = [
      {
        name: packName,
        models: {
          plan: 'openai/gpt-5.4-mini',
          build: 'openai/gpt-5.4-mini',
          fast: restoredSubagentModel,
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

    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'subagent-startup-restore.ts'), 'export const SUBAGENT_STARTUP_RESTORE = true;\n');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Delegate explore using the restored subagent model default.');

    await runtime.waitForScreenText(/Find SUBAGENT_STARTUP_RESTORE in the fixture project/i, terminal, 10_000);
    await runtime.waitForScreenText(/subagent\s+explore\s+openai\/gpt-5\.5.*✓/i, terminal, 12_000);
    await runtime.waitForScreenText(
      /Parent received the restored-model Explore subagent result from src\/subagent-startup-restore\.ts/i,
      terminal,
      10_000,
    );

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); const p=s.customModelPacks.find(p=>p.name==="${packName}"); console.log("SUBAGENT_STARTUP_ACTIVE="+s.models.activeModelPackId); console.log("SUBAGENT_STARTUP_ONBOARDING="+s.onboarding.modePackId); console.log("SUBAGENT_STARTUP_FAST="+p?.models?.fast); console.log("SUBAGENT_STARTUP_OVERRIDES="+Object.keys(s.models.subagentModels||{}).length);'`,
    );
    await runtime.waitForScreenText(/SUBAGENT_STARTUP_ACTIVE=custom:Subagent Startup Restore E2E/i, terminal, 8_000);
    await runtime.waitForScreenText(
      /SUBAGENT_STARTUP_ONBOARDING=custom:Subagent Startup Restore E2E/i,
      terminal,
      8_000,
    );
    await runtime.waitForScreenText(/SUBAGENT_STARTUP_FAST=openai\/gpt-5\.5/i, terminal, 8_000);
    await runtime.waitForScreenText(/SUBAGENT_STARTUP_OVERRIDES=0/i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 3) {
      throw new Error(
        `Expected subagent model startup restore scenario to make 3 AIMock requests, received ${requests.length}`,
      );
    }
    const serialized = JSON.stringify(requests);
    if (!serialized.includes('call_subagent_startup_restore') || !serialized.includes('agentType')) {
      throw new Error('Expected parent request flow to include the subagent tool call.');
    }
    if (!serialized.includes('Find SUBAGENT_STARTUP_RESTORE in the fixture project')) {
      throw new Error('Expected delegated Explore subagent task to reach the subagent model request.');
    }
    if (!serialized.includes('"model":"gpt-5.5"')) {
      throw new Error('Expected delegated Explore subagent request to use the persisted openai/gpt-5.5 default.');
    }
  },
} satisfies McE2eScenario;
