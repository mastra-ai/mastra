import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectProject } from '@mastra/code-sdk/utils/project';
import type { McE2eScenario } from './types.js';

const PACK_NAME = 'Thread Resume E2E';
const PACK_ID = `custom:${PACK_NAME}`;

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const threadHistoryScenario: McE2eScenario = {
  name: 'thread-history',
  description: 'Resume a persisted thread, then fork and rename it through the real TUI.',
  testName: 'supports /resume, /fork, and /rename',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({ tui: { resumeThreadId: 'thread-mc-e2e-seeded-history' } });
  },
  prepare({ appDataDir, dbPath, projectDir }) {
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
        name: PACK_NAME,
        url: 'http://127.0.0.1:43211/v1',
        apiKey: 'sk-thread-resume-e2e',
        models: ['plan-e2e', 'build-e2e', 'fast-e2e'],
      },
    ];
    settings.customModelPacks = [
      {
        name: PACK_NAME,
        models: {
          plan: 'thread-resume-e2e/plan-e2e',
          build: 'thread-resume-e2e/build-e2e',
          fast: 'thread-resume-e2e/fast-e2e',
        },
        createdAt: new Date(0).toISOString(),
      },
    ];
    settings.models = { ...settings.models, activeModelPackId: 'openai' };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const now = new Date('2026-06-06T14:30:00.000Z');
    const nowMs = now.getTime();
    const project = detectProject(projectDir);
    const resourceId = project.resourceId;
    const threadId = 'thread-mc-e2e-seeded-history';
    const title = 'E2E seeded history fixture';
    const userText = 'Recovered prior user request from a sanitized fixture.';
    const assistantText = 'Recovered assistant answer from sanitized history.';
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: userText }] });
    const assistantContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: assistantText }] });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(JSON.stringify({ projectPath: project.rootPath, activeModelPackId: PACK_ID }))}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-seeded-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-seeded-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(nowMs + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);
    await runtime.waitForScreenText(/Recovered prior user request from a sanitized fixture/i, terminal);

    terminal.submit(
      '!node -e \'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("RESUMED_ACTIVE_PACK="+s.models.activeModelPackId);\'',
    );
    await runtime.waitForScreenText(/RESUMED_ACTIVE_PACK=custom:Thread Resume E2E/i, terminal, 8_000);

    terminal.submit('/resume');
    await runtime.waitForScreenText(/E2E seeded history fixture/i, terminal);
    runtime.printScreen('after /resume', terminal);

    terminal.write('seeded history');
    await runtime.waitForScreenText(/E2E seeded history fixture/i, terminal);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E seeded history fixture/i, terminal);
    await runtime.waitForScreenText(/Recovered prior user request from a sanitized fixture/i, terminal);
    await runtime.waitForScreenText(/Recovered assistant answer from sanitized history/i, terminal);
    runtime.printScreen('after seeded thread switch', terminal);

    terminal.submit('/clone');
    await runtime.waitForScreenText(/Fork the current thread\?/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Fork the current thread\?/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/Select Thread/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Select Thread/i, terminal);

    terminal.submit('/fork');
    await runtime.waitForScreenText(/Fork the current thread\?/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Give the forked thread a name\?/i, terminal);
    terminal.write('\x1b');
    await runtime.waitForScreenText(/Forked thread: Clone of E2E seeded history fixture/i, terminal);

    terminal.submit('/rename Forked demo thread');
    await runtime.waitForScreenText(/Thread renamed to: Forked demo thread/i, terminal);
    terminal.submit('/resume');
    await runtime.waitForScreenText(/Forked demo thread/i, terminal);
    terminal.write('\x1b');
    runtime.printScreen('after /fork and /rename', terminal);
  },
};
