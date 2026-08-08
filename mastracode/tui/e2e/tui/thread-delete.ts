import { execFileSync } from 'node:child_process';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const CTRL_D = '\u0004';

export const threadDeleteScenario: McE2eScenario = {
  name: 'thread-delete',
  description:
    'Delete a seeded thread from the /threads selector via Ctrl+D: foreign-resource threads are rejected, the current thread is deleted after confirmation, and the selector no longer lists it.',
  testName: 'deletes a thread from the /threads selector with confirmation',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-06T14:30:00.000Z');
    const resourceId = 'mc-e2e-delete-resource';
    const metadata = quoteSql(JSON.stringify({ projectPath: projectDir }));
    const threads = [
      { id: 'thread-mc-e2e-delete-target', title: 'E2E delete target fixture', text: 'Doomed thread message.' },
      { id: 'thread-mc-e2e-delete-survivor', title: 'E2E delete survivor fixture', text: 'Surviving thread message.' },
    ];
    const sql = threads
      .map(({ id, title, text }, index) => {
        const createdAt = quoteSql(new Date(now.getTime() + index * 1000).toISOString());
        const content = quoteSql(JSON.stringify({ format: 2, parts: [{ type: 'text', text }] }));
        return `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(id)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${metadata}, ${createdAt}, ${createdAt});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values (${quoteSql(`msg-${id}`)}, ${quoteSql(id)}, ${content}, 'user', 'v2', ${createdAt}, ${quoteSql(resourceId)});
`;
      })
      .join('\n');
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    // Deleting a thread owned by another resource is rejected
    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E delete target fixture/i, terminal);
    await runtime.waitForScreenText(/Ctrl\+D delete/i, terminal);
    terminal.write('delete target');
    await runtime.waitForScreenText(/E2E delete target fixture/i, terminal);
    terminal.write(CTRL_D);
    await runtime.waitForScreenText(/Cannot delete a thread that belongs to another resource/i, terminal);
    runtime.printScreen('after foreign-resource delete rejection', terminal);

    // Switch to the seeded thread so its resource becomes current
    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E delete target fixture/i, terminal);
    terminal.write('delete target');
    await runtime.waitForScreenText(/E2E delete target fixture/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to: E2E delete target fixture/i, terminal);
    runtime.printScreen('after switch to delete target', terminal);

    // Delete the (now current) thread via Ctrl+D and confirm
    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E delete target fixture/i, terminal);
    terminal.write('delete target');
    await runtime.waitForScreenText(/E2E delete target fixture/i, terminal);
    terminal.write(CTRL_D);
    await runtime.waitForScreenText(/Delete thread "E2E delete target fixture"\? This cannot be undone/i, terminal);
    runtime.printScreen('delete confirmation modal', terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Deleted thread: E2E delete target fixture/i, terminal);
    runtime.printScreen('after delete', terminal);

    // The selector no longer lists the deleted thread
    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E delete survivor fixture/i, terminal);
    expect(terminal.serialize().view).not.toContain('E2E delete target fixture');
    runtime.printScreen('after reopening /threads', terminal);
  },
};
