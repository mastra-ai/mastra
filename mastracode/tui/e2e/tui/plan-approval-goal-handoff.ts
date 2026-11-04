import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

let holdNextResponse = false;
let releaseResume: () => void;

const EXPECTED_OBJECTIVE =
  '# E2E Goal Plan\n\n## Overview\nUse this plan as a persistent goal from the real TUI.\n\n## Steps\n1. Render the submitted plan.\n2. Select Use as /goal.\n3. Start the goal handoff.\n\n## Verification\nConfirm the goal handoff starts the canonical goal run.';

function readGoalObjective(dbPath: string): string {
  return execFileSync(
    'sqlite3',
    [
      dbPath,
      "select json_extract(value, '$.objective') from mastra_thread_state where type = 'goal' order by updatedAt desc limit 1;",
    ],
    { encoding: 'utf8' },
  ).trim();
}

export const planApprovalGoalHandoffScenario: McE2eScenario = {
  name: 'plan-approval-goal-handoff',
  description: 'Use AIMock submit_plan and select Use as /goal through the real TUI.',
  testName: 'sets the approved plan as the goal and delivers its reminder into the resumed run',
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
  async inProcessApp({ startMastraCodeApp }) {
    holdNextResponse = false;
    const resumeGate = new Promise<void>(resolve => {
      releaseResume = resolve;
    });
    const patches = createGlobalPatchScope();
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes('/chat/completions') && !url.includes('/responses')) return originalFetch(input, init);
      const hold = holdNextResponse;
      if (hold) holdNextResponse = false;
      const response = await originalFetch(input, init);
      if (!hold || !response.body) return response;
      // Deliver text deltas but keep the resumed run open until the screen assertion.
      return new Response(
        response.body.pipeThrough(
          new TransformStream({
            async flush() {
              await resumeGate;
            },
          }),
        ),
        { status: response.status, headers: response.headers },
      );
    });
    try {
      const app = await startMastraCodeApp();
      return {
        stop: () => {
          releaseResume();
          return patches.stopApp(app.stop);
        },
      };
    } catch (error) {
      releaseResume();
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime, dbPath }) {
    runtime.startLiveOutput(terminal);
    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();

    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/\bplan · /i, terminal, 8_000);

    terminal.submit('Create a concise goal implementation plan for the plan approval e2e test.');
    await runtime.waitForScreenText(/Plan: E2E Goal Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Use as \/goal\s+switch to Build mode and pursue this plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Confirm the goal handoff starts the canonical goal run/i, terminal, 10_000);

    holdNextResponse = true;
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Resumed plan output after approval\./i, terminal, 10_000);
    // The plan replaces the goal before the approved run continues, so the
    // judge evaluates that run against the plan.
    if (readGoalObjective(dbPath) !== EXPECTED_OBJECTIVE) {
      throw new Error('The approved plan was not set as the goal before the resumed run continued');
    }
    releaseResume();

    await runtime.waitForScreenText(/✓\s+Set as goal/i, terminal, 10_000);
    await runtime.waitForScreenText(/Goal \(3 max attempts, judge:/i, terminal, 15_000);
    await runtime.waitForScreenText(/Goal\s+●\s+done/i, terminal, 15_000);
    // Give a stray second goal run time to surface before checking for one.
    await new Promise(resolve => setTimeout(resolve, 1_000));
    const view = terminal.serialize().view;
    if (/Unexpected second goal run\.|Goal\s+◌\s+waiting/i.test(view)) {
      throw new Error('A second goal run started after the plan goal was judged done');
    }
    if (!/\bbuild · /.test(view) || /\bplan · /.test(view)) {
      throw new Error('Mode did not stay in Build after the plan goal was judged done');
    }
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const bodies = requests.map(request => JSON.stringify(request));
    const judgeRequests = bodies.filter(body => body.includes('Goal: # E2E Goal Plan'));
    if (judgeRequests.length !== 1) {
      throw new Error(`Expected the plan goal to be judged once, judged ${judgeRequests.length} times`);
    }
    // write_file, submit_plan, and the resumed run: no extra goal run.
    const agentRequests = bodies.filter(
      body => !body.includes('Goal: # E2E Goal Plan') && !body.includes('generate a short title'),
    );
    if (agentRequests.length !== 3) {
      throw new Error(`Expected 3 agent requests, received ${agentRequests.length}`);
    }
    const body = bodies.join('\n');
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
