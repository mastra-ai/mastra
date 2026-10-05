import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

const PLANNING_GOAL = 'Produce an approved plan for the active goal e2e.';

export const planApprovalGoalReplacesActiveScenario: McE2eScenario = {
  name: 'plan-approval-goal-replaces-active',
  description: 'Select Use as /goal while a goal is active and verify the plan goal judges the resumed run.',
  testName: 'replaces the active goal with the approved plan before the resumed run is judged',
  useOpenAIModel: true,
  aimockFixture: 'plan-approval-goal-replaces-active.json',
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
    await runtime.waitForScreenText(/\bplan · /i, terminal, 8_000);

    terminal.submit(`/goal ${PLANNING_GOAL}`);
    await runtime.waitForScreenText(/Plan: E2E Active Goal Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Use as \/goal\s+switch to Build mode and pursue this plan/i, terminal, 10_000);

    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/✓\s+Set as goal/i, terminal, 10_000);
    await runtime.waitForScreenText(/Implemented the approved plan\./i, terminal, 10_000);
    await runtime.waitForScreenText(/The approved plan was implemented\./i, terminal, 15_000);
    // Give a stray second goal run time to surface before checking for one.
    await new Promise(resolve => setTimeout(resolve, 1_000));
    const view = terminal.serialize().view;
    if (/The planning goal judged the implementation run\./.test(view)) {
      throw new Error('The previous goal judged the approved plan run');
    }
    if (/Goal\s+◌\s+waiting/i.test(view)) {
      throw new Error('A second goal run started after the plan goal was judged done');
    }
    if (!/▐build▌/.test(view) || /▐plan▌/.test(view)) {
      throw new Error('Mode did not stay in Build after the plan goal was judged done');
    }
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const bodies = requests.map(request => JSON.stringify(request));
    if (bodies.some(body => body.includes(`Goal: ${PLANNING_GOAL}`))) {
      throw new Error('The previous goal was judged after the plan was approved as a goal');
    }
    const planJudgeRequests = bodies.filter(body => body.includes('Goal: # E2E Active Goal Plan'));
    if (planJudgeRequests.length !== 1) {
      throw new Error(`Expected the plan goal to be judged once, judged ${planJudgeRequests.length} times`);
    }
    // write_file, submit_plan, and the resumed run: no extra goal run.
    const agentRequests = bodies.filter(
      body => !body.includes('Goal: # E2E Active Goal Plan') && !body.includes('generate a short title'),
    );
    if (agentRequests.length !== 3) {
      throw new Error(`Expected 3 agent requests, received ${agentRequests.length}`);
    }
  },
};
