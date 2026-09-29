import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const SCRIPT_MARKER = 'SCHEDULE-CHECK-OK';
const EXTRA_PROMPT = 'Report the result';
const BUSY_PROMPT = 'BUSY-SCHEDULE-PING';

export const schedulesCommandScenario: McE2eScenario = {
  name: 'schedules-command',
  description:
    'Create a script-backed /schedules entry, fire it manually, and verify the script output reaches the model as a schedule turn; then fire a schedule while the agent is busy and verify it is delivered to the running agent.',
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

    terminal.submit('/schedules');
    await runtime.waitForScreenText(/No schedules on this thread/i, terminal);

    terminal.submit(`/schedules create 5m ./check.sh ${EXTRA_PROMPT}`);
    await runtime.waitForScreenText(/Created schedule/i, terminal, 30_000);
    runtime.printScreen('after create', terminal);

    terminal.submit('/schedules');
    await runtime.waitForScreenText(/every 5m/i, terminal);
    await runtime.waitForScreenText(/check\.sh/i, terminal);
    runtime.printScreen('after list', terminal);

    terminal.submit('/schedules run');
    await runtime.waitForScreenText(/Triggered schedule/i, terminal, 30_000);
    await runtime.waitForScreenText(/Schedule tick handled\./i, terminal, 60_000);
    runtime.printScreen('after manual fire', terminal);

    const firedView = terminal.serialize().view;
    expect(firedView).toContain('schedule');
    expect(firedView).toContain(SCRIPT_MARKER);
    expect(firedView).toContain(EXTRA_PROMPT);

    terminal.submit('/schedules delete');
    await runtime.waitForScreenText(/Deleted schedule/i, terminal);

    terminal.submit('/schedules');
    await runtime.waitForScreenText(/No schedules on this thread/i, terminal);
    runtime.printScreen('after delete', terminal);

    // A fire that lands while the agent is busy must reach the running agent,
    // not just be written to history.
    terminal.submit(`/schedules create 1h ${BUSY_PROMPT}`);
    await runtime.waitForScreenText(/Created schedule/i, terminal, 30_000);
    terminal.submit('Start a slow scheduled run.');
    await runtime.waitForScreenText(/Slow run/i, terminal, 15_000);
    terminal.submit('/schedules run');
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
