import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const HISTORY_THREAD_TITLE = 'E2E grouped shell history fixture';

/** Index of the screen line containing `text`, so rows can be checked for adjacency within one box. */
function lineIndex(lines: string[], text: string): number {
  const index = lines.findIndex(line => line.includes(text));
  if (index === -1) throw new Error(`Expected screen to contain a line with ${JSON.stringify(text)}`);
  return index;
}

export const quietShellGroupedScenario: McE2eScenario = {
  name: 'quiet-shell-grouped',
  description:
    'Verify quiet mode with no preview lines groups described shell calls into one box per directory, marks failures by exit code, and keeps run times when history reloads.',
  testName: 'groups quiet shell calls per directory and restores their run time from history',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'quiet-shell-grouped.json',
  prepare({ appDataDir, dbPath, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = { ...settings.onboarding, quietModePreferenceSelected: true };
    settings.preferences = { ...settings.preferences, quietMode: true, quietModeMaxToolPreviewLines: 0 };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    mkdirSync(join(projectDir, 'packages', 'core'), { recursive: true });
    writeFileSync(join(projectDir, 'packages', 'core', 'grouped-marker.txt'), 'marker\n');

    // Stored like a real run: the tool-invocation part has no timestamp, so run time is recovered
    // from the tool's own data parts and the step that starts after it.
    const now = new Date('2026-06-11T18:30:00.000Z');
    const resourceId = 'mc-e2e-grouped-shell-history-resource';
    const threadId = 'thread-mc-e2e-grouped-shell-history';
    const startedAt = now.getTime() + 1_000;
    const userContent = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'Load grouped shell history.' }] });
    const assistantContent = JSON.stringify({
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'grouped-history-sleep',
            toolName: 'execute_command',
            args: { description: 'Sleeping through the loaded history run', command: 'sleep 3' },
            result: '',
          },
        },
        { type: 'data-workspace-metadata', data: {}, createdAt: startedAt },
        {
          type: 'data-sandbox-exit',
          data: { toolCallId: 'grouped-history-sleep', exitCode: 0, success: true, executionTimeMs: 2_940 },
          createdAt: startedAt + 3_028,
        },
        { type: 'step-start', createdAt: startedAt + 3_078 },
        { type: 'text', text: 'Grouped shell history loaded.', createdAt: startedAt + 3_500 },
      ],
    });
    const sql = `
insert into mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt)
values (${quoteSql(threadId)}, ${quoteSql(resourceId)}, ${quoteSql(HISTORY_THREAD_TITLE)}, '{}', ${quoteSql(now.toISOString())}, ${quoteSql(now.toISOString())});
insert into mastra_messages (id, thread_id, content, role, type, createdAt, resourceId)
values
  ('msg-mc-e2e-grouped-shell-user', ${quoteSql(threadId)}, ${quoteSql(userContent)}, 'user', 'v2', ${quoteSql(now.toISOString())}, ${quoteSql(resourceId)}),
  ('msg-mc-e2e-grouped-shell-assistant', ${quoteSql(threadId)}, ${quoteSql(assistantContent)}, 'assistant', 'v2', ${quoteSql(new Date(startedAt).toISOString())}, ${quoteSql(resourceId)});
`;
    execFileSync('sqlite3', [dbPath], { input: sql });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Run the grouped shell commands.');
    await runtime.waitForScreenText(/Grouped shell commands complete\./i, terminal, 30_000);
    await runtime.waitForScreenText(/\$ \.\/packages\/core/, terminal, 5_000);
    runtime.printScreen('grouped quiet shell boxes', terminal);

    const lines = terminal.serialize().view.split('\n');
    // Output mentioning "error:" from a command that exited 0 is still a success.
    expect(lines[lineIndex(lines, 'Printing output that mentions an error')]).toMatch(/✓ Printing output/);
    // A nonzero exit is a failure, explained on the row below.
    const missing = lineIndex(lines, 'Listing a path that does not exist');
    expect(lines[missing]).toMatch(/✗ Listing a path/);
    expect(lines[missing + 1]).toMatch(/└▸ .*definitely-not-a-real-path/);
    // Both project-root calls share one box: the second row directly follows the first.
    if (missing !== lineIndex(lines, 'Printing output that mentions an error') + 1) {
      throw new Error('Expected both project-root shell calls to share one box');
    }
    // The nested directory gets its own box and header.
    const nestedHeader = lineIndex(lines, '$ ./packages/core');
    expect(nestedHeader).toBeGreaterThan(missing + 1);
    expect(lines[nestedHeader - 1]).toMatch(/╭─+╮/);
    expect(lines[lineIndex(lines, 'Listing the nested package')]).toMatch(/✓ Listing the nested package/);
    expect(terminal.serialize().view).not.toMatch(/\$ printf|\$ ls \/definitely/);

    terminal.submit('/threads');
    await runtime.waitForScreenText(/E2E grouped shell history fixture/i, terminal, 8_000);
    terminal.write('grouped shell history');
    await runtime.waitForScreenText(/E2E grouped shell history fixture/i, terminal, 8_000);
    terminal.write('\r');

    await runtime.waitForScreenText(/Grouped shell history loaded\./i, terminal, 8_000);
    // The sandbox's recorded run time wins over the 3.1s between the surrounding parts.
    await runtime.waitForScreenText(/✓ Sleeping through the loaded history run +2\.9s/, terminal, 5_000);
    runtime.printScreen('grouped quiet shell history', terminal);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    for (const id of ['call_grouped_error_text', 'call_grouped_missing_path', 'call_grouped_subdir']) {
      if (!serialized.includes(id)) throw new Error(`Expected AIMock request flow to include ${id}`);
    }
  },
};
