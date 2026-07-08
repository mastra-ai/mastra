import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const pruneCommandScenario: McE2eScenario = {
  name: 'prune-command',
  description:
    'Exercise the /prune command: hands the terminal off from the TUI, prunes retention rows, and vacuums local libsql with progress output.',
  testName: 'closes the TUI and runs storage maintenance with progress output',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();
    runtime.printScreen('after startup', terminal);

    // Unknown options are rejected without leaving the TUI
    terminal.submit('/prune bogus');
    await runtime.waitForScreenText(/Unknown \/prune option: bogus/i, terminal);
    runtime.printScreen('after /prune bogus', terminal);

    // /prune vacuum keep-memory stops the TUI, then prunes (skipping chat
    // history) + vacuums with plain-text progress
    terminal.submit('/prune vacuum keep-memory');
    await runtime.waitForOutputText(/Closing the TUI to run storage maintenance/i, terminal);
    await runtime.waitForOutputText(/Pruning rows older than the retention policies/i, terminal);
    await runtime.waitForOutputText(/observability\.spans: 14d/i, terminal);
    await runtime.waitForOutputText(/memory\.messages: kept \(keep-memory\)/i, terminal);
    // Fresh e2e database has no retention-eligible rows
    await runtime.waitForOutputText(/Nothing to prune|rows deleted/i, terminal);
    // Long db paths wrap across terminal lines, so don't match on the path itself
    await runtime.waitForOutputText(/vacuuming /i, terminal, 30_000);
    await runtime.waitForOutputText(/Reclaimed .*(B|KB|MB|GB)/i, terminal, 30_000);
    await runtime.waitForOutputText(
      /Storage maintenance complete\. Run mastracode to start a new session\./i,
      terminal,
    );
    runtime.printScreen('after /prune vacuum keep-memory', terminal);
  },
};
