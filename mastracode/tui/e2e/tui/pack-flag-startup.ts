import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectProject } from '@mastra/code-sdk/utils/project';
import type { McE2eMastraCodeAppResult, McE2eScenario } from './types.js';

const packName = 'Pack Flag E2E';
const packId = `custom:${packName}`;
const otherPackId = 'custom:Other E2E Pack';
const threadId = 'pack-flag-startup-thread';

let app: McE2eMastraCodeAppResult;

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const packFlagStartupScenario = {
  name: 'pack-flag-startup',
  description:
    "A --pack startup pack applies to a resumed thread, overriding the thread's sticky pack like /models → Activate.",
  testName: 'applies the startup pack over the resumed thread\u2019s sticky pack',
  inProcessApp: context =>
    context.startMastraCodeApp({
      onCreated: result => {
        app = result;
      },
      // Mirrors main.ts: the validated --pack id goes to the TUI, which applies
      // it after startup thread selection.
      tui: { resumeThreadId: threadId, initialPackId: packId },
    }),
  prepare({ appDataDir, dbPath, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = {
      ...settings.onboarding,
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
    };
    settings.customProviders = [
      {
        name: 'Pack Flag E2E',
        url: 'http://127.0.0.1:43211/v1',
        apiKey: 'sk-pack-flag-e2e',
        models: ['plan-e2e', 'build-e2e', 'fast-e2e', 'other-build-e2e'],
      },
    ];
    settings.customModelPacks = [
      {
        name: packName,
        models: {
          plan: 'pack-flag-e2e/plan-e2e',
          build: 'pack-flag-e2e/build-e2e',
          fast: 'pack-flag-e2e/fast-e2e',
        },
        createdAt: new Date(0).toISOString(),
      },
      {
        name: 'Other E2E Pack',
        models: {
          plan: 'pack-flag-e2e/other-build-e2e',
          build: 'pack-flag-e2e/other-build-e2e',
          fast: 'pack-flag-e2e/other-build-e2e',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    // Mirrors main.ts activating --pack in settings (as /models → Activate
    // does) before the TUI starts.
    settings.models = {
      ...settings.models,
      activeModelPackId: packId,
      modeDefaults: {
        plan: 'pack-flag-e2e/plan-e2e',
        build: 'pack-flag-e2e/build-e2e',
        fast: 'pack-flag-e2e/fast-e2e',
      },
      subagentModels: {},
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // A resumed thread stuck to a different pack and model: --pack must win.
    const project = detectProject(projectDir);
    const metadata = {
      projectPath: project.rootPath,
      currentModeId: 'build',
      currentModelId: 'pack-flag-e2e/other-build-e2e',
      modelPersistenceVersion: 2,
      activeModelPackId: otherPackId,
    };
    const now = new Date(0).toISOString();
    execFileSync('sqlite3', [dbPath], {
      input: `INSERT INTO mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
VALUES (${quoteSql(threadId)}, ${quoteSql(project.resourceId)}, 'Pack flag startup', ${quoteSql(JSON.stringify(metadata))}, ${quoteSql(now)}, ${quoteSql(now)});`,
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal);
    runtime.printScreen('after startup', terminal);

    // The startup pack replaced the resumed thread's sticky pack and model.
    await runtime.waitForScreenText(/\bbuild · pack-flag-e2e\/build-e2e/i, terminal, 8_000);
    assert.equal(app.session.thread.getId(), threadId);
    assert.equal(app.session.model.get(), 'pack-flag-e2e/build-e2e');
    assert.equal(app.session.subagents.model.get({ agentType: 'explore' }), 'pack-flag-e2e/fast-e2e');
    assert.equal(app.session.subagents.model.get({ agentType: 'plan' }), 'pack-flag-e2e/plan-e2e');
    assert.equal(app.session.subagents.model.get({ agentType: 'execute' }), 'pack-flag-e2e/build-e2e');

    const thread = (await app.session.thread.getById({ threadId }))!;
    assert.equal(thread.metadata?.activeModelPackId, packId);

    const state = app.session.state.get() as Record<string, any>;
    assert.deepEqual(
      state.modelRoute?.entries?.map((entry: any) => entry.modelId),
      ['pack-flag-e2e/build-e2e'],
    );

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
