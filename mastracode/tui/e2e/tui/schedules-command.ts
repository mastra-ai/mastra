import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const SCRIPT_MARKER = 'SCHEDULE-CHECK-OK';
const EXTRA_PROMPT = 'Report the result';

export const schedulesCommandScenario: McE2eScenario = {
  name: 'schedules-command',
  description:
    'Create a script-backed /schedules entry, fire it manually, and verify the script output reaches the model as a schedule turn.',
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

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const serializedBodies = requests.map(request => JSON.stringify((request as { body?: unknown }).body));
    const scheduleRequests = serializedBodies.filter(
      body => body.includes(SCRIPT_MARKER) && body.includes(EXTRA_PROMPT) && body.includes('source=\\"schedule\\"'),
    );
    expect(scheduleRequests).toHaveLength(1);
  },
};
