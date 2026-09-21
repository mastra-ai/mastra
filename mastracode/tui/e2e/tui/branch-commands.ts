import { execFileSync } from 'node:child_process';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export const branchCommandsScenario: McE2eScenario = {
  name: 'branch-commands',
  description:
    'Branch a seeded thread with /branch, see fork markers on both views, and navigate with /parent and /branches.',
  testName: 'branches a thread and navigates branch lineage from the real TUI',
  prepare({ dbPath, projectDir }) {
    const now = new Date('2026-06-06T14:30:00.000Z');
    const nowMs = now.getTime();
    const resourceId = 'mc-e2e-branch-resource';
    const threadId = 'thread-mc-e2e-branch-source';
    const title = 'E2E branch source fixture';
    const userText = 'Seeded user request for the branching fixture.';
    const assistantText = 'Seeded assistant answer for the branching fixture.';
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: userText }] });
    const assistantContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: assistantText }] });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(title)}, ${quoteSql(JSON.stringify({ projectPath: projectDir }))}, ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-branch-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-branch-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(nowMs + 1000).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    // Switch to the seeded source thread.
    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E branch source fixture/i, terminal);
    terminal.write('branch source');
    await runtime.waitForScreenText(/E2E branch source fixture/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Seeded assistant answer for the branching fixture/i, terminal);

    // /branch: confirm, name the branch, land on the branch view.
    terminal.submit('/branch');
    await runtime.waitForScreenText(/Branch from "Seeded assistant answer/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Give the branch a name/i, terminal);
    terminal.write('E2E branch child');
    terminal.write('\r');
    await runtime.waitForScreenText(/Branched thread: E2E branch child/i, terminal);
    runtime.printScreen('after /branch', terminal);

    // Branch view shows the origin marker at the fork point.
    await runtime.waitForScreenText(/Branched from "E2E branch source fixture"/i, terminal);

    // /parent navigates back to the source thread.
    terminal.submit('/parent');
    await runtime.waitForScreenText(/Switched to parent: E2E branch source fixture/i, terminal);

    // Source view shows where the branch forked.
    await runtime.waitForScreenText(/Branch "E2E branch child" forked here/i, terminal);
    runtime.printScreen('after /parent', terminal);

    // /branches lists child branches from the parent and jumps to the pick.
    terminal.submit('/branches');
    await runtime.waitForScreenText(/Branches of this thread/i, terminal);
    await runtime.waitForScreenText(/E2E branch child/i, terminal);
    terminal.write('\r');
    await runtime.waitForScreenText(/Switched to branch: E2E branch child/i, terminal);
    runtime.printScreen('after /branches', terminal);
  },
};
