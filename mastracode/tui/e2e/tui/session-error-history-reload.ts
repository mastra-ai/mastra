import { execFileSync } from 'node:child_process';

import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const LLM_ERROR = 'Deterministic LLM failure persisted from history.';
const RESUME_ERROR = 'Deterministic resume failure persisted from history.';

export const sessionErrorHistoryReloadScenario: McE2eScenario = {
  name: 'session-error-history-reload',
  description: 'Reopen a thread and render persisted session failures exactly once in chronological order.',
  testName: 'restores persisted LLM and resume errors from thread history',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-09-08T12:00:00.000Z');
    const resourceId = 'mc-e2e-session-error-history-resource';
    const threadId = 'thread-mc-e2e-session-error-history';
    const metadata = JSON.stringify({ projectPath: projectDir });
    const message = (occurrenceId: string, message: string) =>
      JSON.stringify({
        format: 2,
        parts: [{ type: 'data-session-error', data: { occurrenceId, name: 'Error', message } }],
      });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, 'Persisted session errors', ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('session-error-llm', ${quoteSql(threadId)}, ${quoteSql(message('llm-error', LLM_ERROR))}, 'assistant', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('session-error-resume', ${quoteSql(threadId)}, ${quoteSql(message('resume-error', RESUME_ERROR))}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/Persisted session errors/i, terminal, 8_000);
    terminal.write('persisted session');
    terminal.write('\r');

    await runtime.waitForScreenText(new RegExp(LLM_ERROR), terminal, 8_000);
    await runtime.waitForScreenText(new RegExp(RESUME_ERROR), terminal, 8_000);
    const screen = terminal.serialize().view;
    if (screen.indexOf(LLM_ERROR) >= screen.indexOf(RESUME_ERROR)) {
      throw new Error('Persisted session errors were not rendered chronologically');
    }
    if (screen.split(LLM_ERROR).length !== 2 || screen.split(RESUME_ERROR).length !== 2) {
      throw new Error('Persisted session errors were rendered more than once');
    }
    terminal.keyCtrlC();
  },
};
