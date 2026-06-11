import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const toolHistoryReloadScenario: McE2eScenario = {
  name: 'tool-history-reload',
  description: 'Load persisted tool call history and verify tool result rendering reconstructs in the real TUI.',
  testName: 'restores completed tool rendering from loaded history',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-07T13:00:00.000Z');
    const resourceId = 'mc-e2e-tool-history-resource';
    const threadId = 'thread-mc-e2e-tool-history';
    const metadata = JSON.stringify({ projectPath: projectDir });
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Load the tool history fixture.' }],
    });
    const webResult = JSON.stringify({
      action: { query: 'Loaded history web search' },
      sources: [
        {
          title: 'Loaded History Web Result',
          url: 'https://example.test/loaded-history-web',
        },
      ],
      encryptedContent: 'SHOULD_NOT_RENDER_LOADED_HISTORY_WEB',
    });
    const tasks = [
      {
        id: 'history-task-1',
        content: 'Loaded history task one',
        status: 'completed',
        activeForm: 'Loading history task one',
      },
      {
        id: 'history-task-2',
        content: 'Loaded history task two',
        status: 'completed',
        activeForm: 'Loading history task two',
      },
    ];
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [
        { type: 'text', text: 'Loaded tool history answer begins.' },
        {
          type: 'tool-call',
          toolCallId: 'tool-history-view',
          toolName: 'view',
          args: { path: 'src/history-tool.ts', offset: 1, limit: 3 },
        },
        {
          type: 'tool-result',
          toolCallId: 'tool-history-view',
          toolName: 'view',
          result:
            'src/history-tool.ts:1-3\nexport const HISTORY_TOOL_RELOAD = true;\nexport const HISTORY_TOOL_VALUE = 42;',
          isError: false,
        },
        {
          type: 'tool-call',
          toolCallId: 'tool-history-web',
          toolName: 'web_search_20250305',
          args: { query: 'Loaded history web search' },
        },
        {
          type: 'tool-result',
          toolCallId: 'tool-history-web',
          toolName: 'web_search_20250305',
          result: webResult,
          isError: false,
        },
        {
          type: 'tool-call',
          toolCallId: 'tool-history-task-write',
          toolName: 'task_write',
          args: { tasks },
        },
        {
          type: 'tool-result',
          toolCallId: 'tool-history-task-write',
          toolName: 'task_write',
          result: { tasks },
          isError: false,
        },
        { type: 'text', text: 'Loaded tool history answer complete.' },
      ],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, 'E2E loaded tool history fixture', ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-tool-history-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-tool-history-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E loaded tool history fixture/i, terminal, 8_000);
    terminal.write('loaded tool history');
    await runtime.waitForScreenText(/E2E loaded tool history fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E loaded tool history fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/Loaded tool history answer begins/i, terminal, 8_000);
    await runtime.waitForScreenText(/view\s+src\/history-tool\.ts.*✓/i, terminal, 8_000);
    await runtime.waitForScreenText(/HISTORY_TOOL_RELOAD\s+=\s+true/i, terminal, 8_000);
    await runtime.waitForScreenText(/Loaded History Web Result/i, terminal, 8_000);
    await runtime.waitForScreenText(/https:\/\/example\.test\/loaded-history-web/i, terminal, 8_000);
    await runtime.waitForScreenText(/web_search\s+"Loaded history web search".*✓/i, terminal, 8_000);
    await runtime.waitForScreenText(/Tasks\s+\[2\/2 completed\]/i, terminal, 8_000);
    await runtime.waitForScreenText(/Loaded history task one/i, terminal, 8_000);
    await runtime.waitForScreenText(/Loaded history task two/i, terminal, 8_000);
    await runtime.waitForScreenText(/Loaded tool history answer complete/i, terminal, 8_000);

    const screen = terminal.serialize().view;
    if (screen.includes('SHOULD_NOT_RENDER_LOADED_HISTORY_WEB')) {
      throw new Error('Loaded history web search rendering leaked encrypted provider content');
    }

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
};
