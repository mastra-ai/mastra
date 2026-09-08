import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario } from './types.js';

let holdNextResponse = false;
let releaseResume: () => void;

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
  testName: 'renders resumed plan output before starting the approved plan as a goal',
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
    await runtime.waitForScreenText(/▐plan▌/i, terminal, 8_000);

    terminal.submit('Create a concise goal implementation plan for the plan approval e2e test.');
    await runtime.waitForScreenText(/Plan: E2E Goal Plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Use as \/goal\s+— switch to Build mode and pursue this plan/i, terminal, 10_000);
    await runtime.waitForScreenText(/Confirm the goal handoff starts the canonical goal run/i, terminal, 10_000);

    holdNextResponse = true;
    terminal.write('\x1b[B');
    terminal.write('\r');

    await runtime.waitForScreenText(/Resumed plan output before goal startup\./i, terminal, 10_000);
    if (readGoalObjective(dbPath) || /Goal \(judge:/.test(terminal.serialize().view)) {
      throw new Error('Goal started before the resumed plan run finished');
    }
    releaseResume();

    await runtime.waitForScreenText(/✓\s+Set as goal/i, terminal, 10_000);
    await runtime.waitForScreenText(/Plan goal handoff e2e goal run started\./i, terminal, 15_000);
    const expectedObjective =
      '# E2E Goal Plan\n\n## Overview\nUse this plan as a persistent goal from the real TUI.\n\n## Steps\n1. Render the submitted plan.\n2. Select Use as /goal.\n3. Start the goal handoff.\n\n## Verification\nConfirm the goal handoff starts the canonical goal run.';
    if (readGoalObjective(dbPath) !== expectedObjective) {
      throw new Error('The started goal did not preserve the complete approved plan');
    }

    await runtime.waitForScreenText(/Goal\s+●\s+done/i, terminal, 15_000);
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
