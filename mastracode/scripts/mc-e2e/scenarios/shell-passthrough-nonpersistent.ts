import { expect } from '@microsoft/tui-test';

import type { McE2eScenario } from './types.js';

export const shellPassthroughNonpersistentScenario: McE2eScenario = {
  name: 'shell-passthrough-nonpersistent',
  description: 'Prove local shell passthrough output is not persisted as conversation history.',
  testName: 'keeps shell passthrough output local-only instead of storing it in message history',
  useOpenAIModel: true,
  aimockFixture: 'shell-passthrough-nonpersistent.json',
  env({ dbPath }) {
    return {
      SHELL_NONPERSIST_DB_PATH: dbPath,
      SHELL_NONPERSIST_SENTINEL: 'SHELL_LOCAL_ONLY_HISTORY_SENTINEL_1765600000',
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/Project:\s+mastra/i, terminal, 8_000);

    terminal.submit(`!printf '%s\\n' "$SHELL_NONPERSIST_SENTINEL"`);
    await runtime.waitForScreenText(/SHELL_LOCAL_ONLY_HISTORY_SENTINEL_1765600000/i, terminal, 8_000);
    await runtime.waitForScreenText(/\$ printf .*✓/i, terminal, 8_000);

    terminal.submit(
      `!sqlite3 "$SHELL_NONPERSIST_DB_PATH" "select 'SHELL_NONPERSIST_DB_COUNT=' || count(*) from mastra_messages where content like '%' || '$SHELL_NONPERSIST_SENTINEL' || '%';"`,
    );
    await runtime.waitForScreenText(/SHELL_NONPERSIST_DB_COUNT=0/i, terminal, 8_000);

    terminal.submit('Confirm shell passthrough non persistence probe complete.');
    await runtime.waitForScreenText(/Shell non persistence model confirmation\./i, terminal, 8_000);

    expect(terminal.serialize().view).toContain('SHELL_NONPERSIST_DB_COUNT=0');
    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
  verifyAimockRequests(requests) {
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).toContain('Confirm shell passthrough non persistence probe complete.');
    expect(JSON.stringify(requests[0])).not.toContain('SHELL_LOCAL_ONLY_HISTORY_SENTINEL_1765600000');
  },
};
