import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

export const fileAttachmentHistoryReloadScenario: McE2eScenario = {
  name: 'file-attachment-history-reload',
  description: 'Load persisted user attachment history and verify text, image, and file parts render in the real TUI.',
  testName: 'restores user attachment rendering from loaded history',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-13T12:00:00.000Z');
    const resourceId = 'mc-e2e-file-attachment-history-resource';
    const threadId = 'thread-mc-e2e-file-attachment-history';
    const title = 'E2E loaded file attachment fixture';
    const metadata = JSON.stringify({ projectPath: projectDir });
    const userContent = JSON.stringify({
      format: 2,
      parts: [
        { type: 'text', text: 'Review loaded attachment history.' },
        { type: 'text', text: '[File: notes.md]\n```\nLoaded text attachment body.\n```' },
        { type: 'file', data: PNG_BASE64, mimeType: 'image/png', filename: 'pixel.png' },
        { type: 'file', data: 'AAEC', mimeType: 'application/octet-stream', filename: 'archive.bin' },
      ],
      metadata: {
        signal: {
          id: 'signal-file-attachment-history-user',
          type: 'user',
          tagName: 'user',
          createdAt: now.toISOString(),
          attributes: { delivery: 'message' },
        },
      },
    });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Loaded attachment history response.' }],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('signal-file-attachment-history-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'signal', 'user', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-file-attachment-history-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E loaded file attachment fixture/i, terminal, 8_000);
    terminal.write('file attachment');
    await runtime.waitForScreenText(/E2E loaded file attachment fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E loaded file attachment fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/\[1 image\] \[1 file\] Review loaded attachment history/i, terminal, 8_000);
    await runtime.waitForScreenText(/\[File: notes\.md\]/i, terminal, 8_000);
    await runtime.waitForScreenText(/Loaded text attachment body/i, terminal, 8_000);
    await runtime.waitForScreenText(/Loaded attachment history response/i, terminal, 8_000);

    const screen = terminal.serialize().view;
    if (screen.includes(PNG_BASE64) || screen.includes('AAEC')) {
      throw new Error('Loaded attachment history leaked raw attachment data into the TUI');
    }

    terminal.keyCtrlC();
  },
};
