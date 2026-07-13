import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

export const planApprovalGoalHandoffScenario: McE2eScenario = {
  name: 'plan-approval-goal-handoff',
  description: 'Use AIMock submit_plan and select Use as /goal through the real TUI.',
  testName: 'sets an AIMock-driven submitted plan as a persistent goal',
  skipReason: 'current main goal judge returns invalid structured scorer output after plan goal handoff',
  useOpenAIModel: true,
  aimockFixture: 'plan-approval-goal-handoff.json',
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

    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/▐plan▌/i, terminal, 8_000);

    terminal.submit('Create a concise goal implementation plan for the plan approval e2e test.');
    await runtime.waitForScreenText(/Plan: E2E Goal Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Use as \/goal\s+— switch to Build mode and pursue this plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Confirm the goal handoff starts the canonical goal run/i, terminal, 10_000);

    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/✓\s+Set as goal/i, terminal, 10_000);
    await runtime.waitForScreenText(/Goal \(judge: openai\/gpt-5\.4-mini\)/i, terminal, 10_000);
    await runtime.waitForScreenText(/# E2E Goal Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/▐[^\r\n▌]+▌[^\r\n]*\bgoal\b(?:[ \t]+<1m)?/i, terminal, 10_000);
    await runtime.waitForScreenText(/Plan goal handoff e2e goal run started\./i, terminal, 15_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 2) {
      throw new Error(
        `Expected plan goal handoff scenario to make at least 2 AIMock requests, received ${requests.length}`,
      );
    }
    const body = JSON.stringify(requests);
    if (!body.includes('call_plan_goal_e2e_submit')) {
      throw new Error('Expected AIMock requests to include the submit_plan tool call id');
    }
    if (!body.includes('# E2E Goal Plan')) {
      throw new Error('Expected AIMock requests to include the plan goal objective');
    }
    if (body.includes('The user has approved the plan, begin executing.')) {
      throw new Error('Use as /goal should not send the approve-to-build handoff reminder');
    }
  },
};
