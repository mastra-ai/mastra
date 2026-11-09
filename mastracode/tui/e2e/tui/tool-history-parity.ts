import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const HISTORY_RESOURCE_ID = 'mc-e2e-compact-history-resource';

export const toolHistoryParityScenario: McE2eScenario = {
  name: 'tool-history-parity',
  description: 'Verify live tool output and loaded tool history render the same compact rows in the real TUI.',
  testName: 'renders live and loaded tool output the same way',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'tool-history-parity.json',
  prepare({ appDataDir, dbPath, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.preferences = {
      ...settings.preferences,
      previewLines: 2,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', 'compact-e2e.ts'),
      [
        'export const LIVE_PREVIEW = "live compact preview";',
        'export const LOADED_PREVIEW = "loaded compact preview";',
        'export const EXTRA_LINE = "this line should stay within the preview cap";',
        '',
      ].join('\n'),
    );

    const now = new Date('2026-06-11T18:30:00.000Z');
    const resourceId = HISTORY_RESOURCE_ID;
    const threadId = 'thread-mc-e2e-compact-history';
    const metadata = JSON.stringify({});
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Load the tool history fixture.' }],
    });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [
        { type: 'text', text: 'Compact loaded history answer begins.' },
        {
          type: 'tool-call',
          toolCallId: 'compact-history-view',
          toolName: 'view',
          args: { path: 'src/compact-e2e.ts', offset: 1, limit: 3 },
        },
        {
          type: 'tool-result',
          toolCallId: 'compact-history-view',
          toolName: 'view',
          result:
            'src/compact-e2e.ts:1-3\n     1→export const LIVE_PREVIEW = "live compact preview";\n     2→export const LOADED_PREVIEW = "loaded compact preview";\n     3→export const EXTRA_LINE = "this line should stay within the preview cap";',
          isError: false,
        },
        { type: 'text', text: 'Compact loaded history answer complete.' },
      ],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, 'E2E compact loaded history fixture', ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-compact-history-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-compact-history-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Render live tool output.');
    await runtime.waitForScreenText(/▐view▌src\/compact-e2e\.ts/i, terminal, 12_000);
    await runtime.waitForScreenText(/LOADED_PREVIEW/i, terminal, 12_000);
    await runtime.waitForScreenText(/0\/1\s+.*Verify compact live task summary/i, terminal, 12_000);
    await runtime.waitForScreenText(/Compact live tool output complete\./i, terminal, 12_000);
    runtime.printScreen('compact live tool output', terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E compact loaded history fixture/i, terminal, 8_000);
    terminal.write('compact loaded history');
    await runtime.waitForScreenText(/E2E compact loaded history fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Compact loaded history answer begins/i, terminal, 8_000);
    await runtime.waitForScreenText(/▐view▌src\/compact-e2e\.ts/i, terminal, 8_000);
    await runtime.waitForScreenText(/LOADED_PREVIEW/i, terminal, 8_000);
    await runtime.waitForScreenText(/Compact loaded history answer complete/i, terminal, 8_000);
    runtime.printScreen('compact loaded tool history', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected tool history parity scenario to make 2 AIMock requests, received ${requests.length}`);
    }
    const serialized = JSON.stringify(requests);
    for (const needle of ['call_live_view', 'call_live_task', 'view', 'task_write']) {
      if (!serialized.includes(needle)) {
        throw new Error(`Expected AIMock request flow to include ${needle}`);
      }
    }
  },
};
