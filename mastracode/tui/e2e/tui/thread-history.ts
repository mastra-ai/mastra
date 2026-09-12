import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const threadHistoryScenario: McE2eScenario = {
  name: 'thread-history',
  description: 'Reopen and clone a persisted thread without deriving current tasks from bounded history.',
  testName: 'keeps durable current tasks separate from reopened and cloned history',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-06T14:30:00.000Z');
    const nowMs = now.getTime();
    const resourceId = 'mc-e2e-seeded-resource';
    const threadId = 'thread-mc-e2e-seeded-history';
    const title = 'E2E seeded history fixture';
    const userText = 'Recovered prior user request from a sanitized fixture.';
    const assistantText = 'Recovered assistant answer from sanitized history.';
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: userText }] });
    const currentTasks = [
      {
        id: 'persisted-task',
        content: 'Persisted task beyond history',
        status: 'pending',
        activeForm: 'Working beyond history',
      },
    ];
    const historicalTasks = [{ ...currentTasks[0], content: 'Earlier task receipt' }];
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [
        { type: 'text', text: assistantText },
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'historical-task-write',
            toolName: 'task_write',
            state: 'result',
            args: { tasks: historicalTasks },
            result: { tasks: historicalTasks },
          },
        },
      ],
    });
    const olderMessages = Array.from({ length: 201 }, (_, index) => {
      const content = JSON.stringify({ format: 2, parts: [{ type: 'text', text: `Older history ${index}` }] });
      const createdAt = new Date(nowMs - (202 - index) * 1000).toISOString();
      return `(${quoteSql(`seeded-older-${index}`)}, ${quoteSql(threadId)}, ${quoteSql(content)}, 'user', 'v2', ${quoteSql(createdAt)}, ${quoteSql(resourceId)})`;
    }).join(',\n');
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(JSON.stringify({ projectPath: projectDir }))}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_thread_state (threadId, type, value, createdAt, updatedAt)
values (${quoteSql(threadId)}, 'task', ${quoteSql(JSON.stringify(currentTasks))}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-seeded-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-seeded-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(nowMs + 1000).toISOString())}, ${quoteSql(resourceId)}),
  ${olderMessages};
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E seeded history fixture/i, terminal);
    runtime.printScreen('after /threads', terminal);

    terminal.write('seeded history');
    await runtime.waitForScreenText(/E2E seeded history fixture/i, terminal);
    terminal.write('\r');

    await runtime.waitForScreenText(/Switched to: E2E seeded history fixture/i, terminal);
    await runtime.waitForScreenText(/Recovered prior user request from a sanitized fixture/i, terminal);
    await runtime.waitForScreenText(/Recovered assistant answer from sanitized history/i, terminal);
    await runtime.waitForScreenText(/Persisted task beyond history/i, terminal);
    await runtime.waitForScreenText(/Tasks\s+\[0\/1 completed\]/i, terminal);
    runtime.printScreen('after seeded thread switch', terminal);

    terminal.submit('/new');
    await runtime.waitForScreenText(/Ready for new conversation/i, terminal);
    await runtime.waitForScreenTextAbsent(/Persisted task beyond history/i, terminal);
    await runtime.waitForScreenTextAbsent(/Tasks\s+\[0\/1 completed\]/i, terminal);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E seeded history fixture/i, terminal);
    terminal.write('seeded history');
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E seeded history fixture/i, terminal);
    await runtime.waitForScreenText(/Persisted task beyond history/i, terminal);

    terminal.submit('/clone');
    await runtime.waitForScreenText(/Clone the current thread/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Give the cloned thread a name/i, terminal);
    terminal.submit('E2E cloned history');
    await runtime.waitForScreenText(/Cloned thread: E2E cloned history/i, terminal);
    await runtime.waitForScreenText(/Recovered assistant answer from sanitized history/i, terminal);
    await runtime.waitForScreenTextAbsent(/Persisted task beyond history/i, terminal);
    await runtime.waitForScreenTextAbsent(/Tasks\s+\[0\/1 completed\]/i, terminal);
  },
};
