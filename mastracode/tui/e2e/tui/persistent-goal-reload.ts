import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const persistentGoalReloadScenario: McE2eScenario = {
  name: 'persistent-goal-reload',
  description: 'Load a durable goal objective from a seeded thread through the real TUI thread picker.',
  testName: 'restores persisted goal status and active duration from thread state',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-07T12:00:00.000Z');
    const resourceId = 'mc-e2e-goal-reload-resource';
    const threadId = 'thread-mc-e2e-goal-reload';
    const goal = {
      id: 'goal-mc-e2e-reload',
      objective: 'Restore persisted goal metadata from loaded history.',
      status: 'active',
      runsUsed: 2,
      maxRuns: 5,
      judgeModelId: 'openai/gpt-5.4-mini',
      startedAt: new Date('2026-06-07T11:58:00.000Z').getTime(),
      updatedAt: now.getTime(),
      activeDurationMs: 60_000,
    };
    const metadata = JSON.stringify({ projectPath: projectDir });
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'Seeded goal reload user turn.' }] });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [{ type: 'text', text: 'Seeded goal reload assistant turn.' }],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, 'E2E persisted goal fixture', ${quoteSql(metadata)}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_thread_state (threadId, type, value, createdAt, updatedAt)
values (${quoteSql(threadId)}, 'goal', ${quoteSql(JSON.stringify(goal))}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-goal-reload-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-goal-reload-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(now.getTime() + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E persisted goal fixture/i, terminal, 8_000);
    terminal.write('persisted goal');
    await runtime.waitForScreenText(/E2E persisted goal fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E persisted goal fixture/i, terminal, 8_000);
    await runtime.waitForScreenText(/Seeded goal reload assistant turn/i, terminal, 8_000);
    await runtime.waitForScreenText(/▐[^▌]+▌.*\bgoal\s+1m/i, terminal, 8_000);

    terminal.submit('/goal status');
    await runtime.waitForScreenText(
      /Goal \(active\): "Restore persisted goal metadata from loaded history\." — 2\/5 turns used \[judge: openai\/gpt-5\.4-mini\]/i,
      terminal,
      8_000,
    );

    terminal.keyCtrlC();
  },
};
