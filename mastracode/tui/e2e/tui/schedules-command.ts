import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import { selectMenuRow } from './menu-navigation.js';
import type { McE2eScenario } from './types.js';

const SCRIPT_MARKER = 'SCHEDULE-CHECK-OK';
const EXTRA_PROMPT = 'Report the result';
const BUSY_PROMPT = 'BUSY-SCHEDULE-PING';

export const schedulesCommandScenario: McE2eScenario = {
  name: 'schedules-command',
  description:
    'Create a script-backed schedule through the /schedules menu, pause it, fire it manually, and verify the script output reaches the model as a schedule turn; then fire a schedule while the agent is busy and verify it is delivered to the running agent.',
  testName: 'creates, fires, and deletes a session-scoped schedule through the real TUI',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'schedules-command.json',
  prepare({ projectDir }) {
    const scriptPath = join(projectDir, 'check.sh');
    writeFileSync(scriptPath, `#!/bin/sh\necho ${SCRIPT_MARKER}\n`);
    chmodSync(scriptPath, 0o755);
  },
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        unixSocketPubSub: false,
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })).toBeVisible();

    terminal.submit('Create a schedules e2e thread.');
    await runtime.waitForScreenText(/Schedules thread ready/i, terminal);

    const openSchedules = async () => {
      terminal.submit('/schedules');
      await runtime.waitForScreenText(/Schedules on this thread|No schedules on this thread yet/i, terminal);
    };

    await openSchedules();
    await runtime.waitForScreenText(/No schedules on this thread yet/i, terminal);
    terminal.write('\x1b');

    // Create: source → script path → extra prompt → cadence → confirm.
    await openSchedules();
    await selectMenuRow(terminal, /Create schedule/);
    await runtime.waitForScreenText(/What should each fire send/i, terminal);
    await selectMenuRow(terminal, /Script\s+Run a script/);
    await runtime.waitForScreenText(/Path to the script to run/i, terminal);
    terminal.submit('./check.sh');
    await runtime.waitForScreenText(/Prompt to send after the script output/i, terminal);
    terminal.submit(EXTRA_PROMPT);
    await runtime.waitForScreenText(/How often/i, terminal);
    await selectMenuRow(terminal, /5m\s+at :00, :05/);
    await runtime.waitForScreenText(/Create schedule every 5m — run \.\/check\.sh/i, terminal);
    await selectMenuRow(terminal, /Create\s*$/);
    await runtime.waitForScreenText(/Created schedule [0-9a-f]{8}: every 5m/i, terminal, 30_000);
    runtime.printScreen('after create', terminal);

    // Pause first so a real 5m boundary can't add a second fire to the count below.
    await openSchedules();
    await selectMenuRow(terminal, /every 5m · next at/);
    await runtime.waitForScreenText(/Run now/i, terminal);
    await selectMenuRow(terminal, /Pause/);
    await runtime.waitForScreenText(/Paused schedule/i, terminal);

    await openSchedules();
    await selectMenuRow(terminal, /every 5m · paused/);
    await runtime.waitForScreenText(/Run now/i, terminal);
    await selectMenuRow(terminal, /Run now/);
    await runtime.waitForScreenText(/Triggered schedule/i, terminal, 30_000);
    await runtime.waitForScreenText(/Schedule tick handled\./i, terminal, 60_000);
    runtime.printScreen('after manual fire', terminal);

    const firedView = terminal.serialize().view;
    expect(firedView).toContain('schedule');
    expect(firedView).toContain(SCRIPT_MARKER);
    expect(firedView).toContain(EXTRA_PROMPT);

    await openSchedules();
    await selectMenuRow(terminal, /every 5m · paused/);
    await runtime.waitForScreenText(/Run now/i, terminal);
    await selectMenuRow(terminal, /Delete\s+Remove this schedule/);
    await runtime.waitForScreenText(/Delete schedule [0-9a-f]{8}\?/i, terminal);
    await selectMenuRow(terminal, /Delete\s*$/);
    await runtime.waitForScreenText(/Deleted schedule/i, terminal);

    await openSchedules();
    await runtime.waitForScreenText(/No schedules on this thread yet/i, terminal);
    terminal.write('\x1b');
    runtime.printScreen('after delete', terminal);

    // A fire that lands while the agent is busy must reach the running agent,
    // not just be written to history.
    await openSchedules();
    await selectMenuRow(terminal, /Create schedule/);
    await runtime.waitForScreenText(/What should each fire send/i, terminal);
    await selectMenuRow(terminal, /Prompt\s+Send the same text/);
    await runtime.waitForScreenText(/Prompt to send on every fire/i, terminal);
    terminal.submit(BUSY_PROMPT);
    await runtime.waitForScreenText(/How often/i, terminal);
    await selectMenuRow(terminal, /1h\s+on the hour/);
    await runtime.waitForScreenText(/Create schedule every 1h/i, terminal);
    await selectMenuRow(terminal, /Create\s*$/);
    await runtime.waitForScreenText(/Created schedule [0-9a-f]{8}: every 1h/i, terminal, 30_000);

    await openSchedules();
    await selectMenuRow(terminal, /every 1h · next at/);
    await runtime.waitForScreenText(/Run now/i, terminal);
    await selectMenuRow(terminal, /Pause/);
    await runtime.waitForScreenText(/Paused schedule[\s\S]*Paused schedule/i, terminal);

    terminal.submit('Start a slow scheduled run.');
    await runtime.waitForScreenText(/Slow run/i, terminal, 15_000);
    await openSchedules();
    await selectMenuRow(terminal, /every 1h · paused/);
    await runtime.waitForScreenText(/Run now/i, terminal);
    await selectMenuRow(terminal, /Run now/);
    await runtime.waitForScreenText(/Busy schedule handled\./i, terminal, 60_000);
    runtime.printScreen('after busy fire', terminal);
    expect(terminal.serialize().view).toContain(BUSY_PROMPT);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    // Later requests replay earlier turns as history, so look at the newest
    // user message of each request to see what each request was answering.
    const latestUserMessages = requests.map(request => {
      const messages = ((request as { body?: { messages?: Array<{ role?: string; content?: unknown }> } }).body
        ?.messages ?? []) as Array<{ role?: string; content?: unknown }>;
      const latest = [...messages].reverse().find(message => message.role === 'user');
      return JSON.stringify(latest?.content ?? '');
    });
    const scheduleFires = latestUserMessages.filter(
      content =>
        content.includes(SCRIPT_MARKER) && content.includes(EXTRA_PROMPT) && content.includes('source=\\"schedule\\"'),
    );
    expect(scheduleFires).toHaveLength(1);
    const busyFires = latestUserMessages.filter(
      content => content.includes(BUSY_PROMPT) && content.includes('source=\\"schedule\\"'),
    );
    expect(busyFires).toHaveLength(1);
  },
};
