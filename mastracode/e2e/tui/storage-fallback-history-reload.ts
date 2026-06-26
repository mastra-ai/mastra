import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const storageFallbackHistoryReloadScenario: McE2eScenario = {
  name: 'storage-fallback-history-reload',
  description: 'Verify PostgreSQL startup fallback keeps local LibSQL history visible in the real TUI.',
  testName: 'loads local history after persisted PostgreSQL settings fall back to LibSQL',
  prepare({ appDataDir, dbPath, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.storage = {
      ...settings.storage,
      backend: 'pg',
      pg: {
        connectionString: '',
        host: undefined,
        port: undefined,
        database: undefined,
        user: undefined,
        password: undefined,
        schemaName: undefined,
        disableInit: undefined,
        skipDefaultIndexes: undefined,
      },
    };
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

    const now = new Date('2026-06-13T15:00:00.000Z');
    const resourceId = 'mc-e2e-storage-fallback-history-resource';
    const threadId = 'thread-mc-e2e-storage-fallback-history';
    const title = 'E2E storage fallback history fixture';
    const metadata = JSON.stringify({ projectPath: projectDir });
    const userContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Open fallback-backed local history.' }],
    });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Fallback LibSQL history survived PostgreSQL startup fallback.' }],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-storage-fallback-history-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-storage-fallback-history-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await runtime.waitForScreenText(/PostgreSQL backend selected but no connection info configured/i, terminal, 8_000);
    await runtime.waitForScreenText(/Using LibSQL fallback/i, terminal, 8_000);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal, 8_000);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E storage fallback history fixture/i, terminal, 8_000);
    terminal.write('fallback history');
    await runtime.waitForScreenText(/E2E storage fallback history fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E storage fallback history fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/Open fallback-backed local history/i, terminal, 8_000);
    await runtime.waitForScreenText(/Fallback LibSQL history survived PostgreSQL startup fallback/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/settings.json","utf8")); console.log("STORAGE_SETTINGS_BACKEND="+s.storage.backend);'`,
    );
    await runtime.waitForScreenText(/STORAGE_SETTINGS_BACKEND=pg/i, terminal, 8_000);
  },
};
