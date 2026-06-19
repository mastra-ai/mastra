import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const quietToolHistoryParityScenario: McE2eScenario = {
  name: 'quiet-tool-history-parity',
  description: 'Verify quiet mode applies to live tool output and loaded tool history in the real TUI.',
  testName: 'renders live and loaded tool output in quiet mode',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'quiet-tool-history-parity.json',
  prepare({ appDataDir, dbPath, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = { ...settings.onboarding, quietModePreferenceSelected: true };
    settings.preferences = {
      ...settings.preferences,
      quietMode: true,
      quietModeMaxToolPreviewLines: 2,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', 'quiet-mode-e2e.ts'),
      [
        'export const QUIET_MODE_LIVE_PREVIEW = "live quiet compact preview";',
        'export const QUIET_MODE_LOADED_PREVIEW = "loaded quiet compact preview";',
        'export const QUIET_MODE_EXTRA_LINE = "this line should stay within the preview cap";',
        '',
      ].join('\n'),
    );

    const now = new Date('2026-06-11T18:30:00.000Z');
    const resourceId = 'mc-e2e-quiet-history-resource';
    const threadId = 'thread-mc-e2e-quiet-history';
    const metadata = JSON.stringify({ projectPath: projectDir });
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Load the quiet mode history fixture.' }],
    });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [
        { type: 'text', text: 'Quiet loaded history answer begins.' },
        {
          type: 'tool-call',
          toolCallId: 'quiet-history-view',
          toolName: 'view',
          args: { path: 'src/quiet-mode-e2e.ts', offset: 1, limit: 3 },
        },
        {
          type: 'tool-result',
          toolCallId: 'quiet-history-view',
          toolName: 'view',
          result:
            'src/quiet-mode-e2e.ts:1-3\n     1→export const QUIET_MODE_LIVE_PREVIEW = "live quiet compact preview";\n     2→export const QUIET_MODE_LOADED_PREVIEW = "loaded quiet compact preview";\n     3→export const QUIET_MODE_EXTRA_LINE = "this line should stay within the preview cap";',
          isError: false,
        },
        { type: 'text', text: 'Quiet loaded history answer complete.' },
      ],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, 'E2E quiet loaded history fixture', ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-quiet-history-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-quiet-history-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Render quiet mode live tool output.');
    await runtime.waitForScreenText(/▐view▌src\/quiet-mode-e2e\.ts/i, terminal, 12_000);
    await runtime.waitForScreenText(/QUIET_MODE_LOADED_PREVIEW/i, terminal, 12_000);
    await runtime.waitForScreenText(/0\/1\s+.*Verify quiet live task summary/i, terminal, 12_000);
    await runtime.waitForScreenText(/Quiet live tool output complete\./i, terminal, 12_000);
    runtime.printScreen('quiet live tool output', terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E quiet loaded history fixture/i, terminal, 8_000);
    terminal.write('quiet loaded history');
    await runtime.waitForScreenText(/E2E quiet loaded history fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E quiet loaded history fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/Quiet loaded history answer begins/i, terminal, 8_000);
    await runtime.waitForScreenText(/▐view▌src\/quiet-mode-e2e\.ts/i, terminal, 8_000);
    await runtime.waitForScreenText(/QUIET_MODE_LOADED_PREVIEW/i, terminal, 8_000);
    await runtime.waitForScreenText(/Quiet loaded history answer complete/i, terminal, 8_000);
    runtime.printScreen('quiet loaded tool history', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected quiet mode scenario to make 2 AIMock requests, received ${requests.length}`);
    }
    const serialized = JSON.stringify(requests);
    for (const needle of ['call_quiet_live_view', 'call_quiet_live_task', 'view', 'task_write']) {
      if (!serialized.includes(needle)) {
        throw new Error(`Expected AIMock request flow to include ${needle}`);
      }
    }
  },
};
