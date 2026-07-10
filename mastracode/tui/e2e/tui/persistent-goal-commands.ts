import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const OBJECTIVE = 'Persist the goal command e2e objective across status commands.';

export const persistentGoalCommandsScenario: McE2eScenario = {
  name: 'persistent-goal-commands',
  description: 'Start, inspect, pause, and clear a persistent goal through real TUI slash commands.',
  testName: 'manages persistent goal command lifecycle in the real TUI',
  skipReason: 'current main goal judge returns invalid structured scorer output in this fixture path',
  useOpenAIModel: true,
  aimockFixture: 'persistent-goal-commands.json',
  prepare({ appDataDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.models = {
      ...settings.models,
      goalJudgeModel: 'openai/gpt-5.4-mini',
      goalMaxTurns: 3,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.submit(`/goal ${OBJECTIVE}`);
    await runtime.waitForScreenText(/Persistent goal command e2e acknowledged\./i, terminal, 15_000);
    await runtime.waitForScreenText(/▐[^▌]+▌.*\bgoal(?:\s+<1m)?/i, terminal, 8_000);

    terminal.submit('/goal pause');
    await runtime.waitForScreenText(/Goal paused: "Persist the goal command e2e objective/i, terminal, 8_000);
    await runtime.waitForScreenText(/continue\./i, terminal, 8_000);

    terminal.submit('/goal clear');
    await runtime.waitForScreenText(/Goal cleared\./i, terminal, 8_000);

    terminal.submit('/goal status');
    await runtime.waitForScreenText(/No goal set\. Use \/goal <text> to set one\./i, terminal, 8_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 1) {
      throw new Error(
        `Expected at least one AIMock request for the initial goal reminder, received ${requests.length}`,
      );
    }
    const body = JSON.stringify(requests);
    if (!body.includes(OBJECTIVE)) {
      throw new Error('Expected AIMock requests to contain the goal objective');
    }
  },
};
