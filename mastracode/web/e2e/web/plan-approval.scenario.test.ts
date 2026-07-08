import { describe, it } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Web equivalent of MastraCode's plan-approval handoff: in plan mode the agent
 * calls `submit_plan`, the UI shows a plan suspension, approving it resumes the
 * run and (per controller semantics) transitions to the default build mode.
 */
describe('web scenario: plan-approval', () => {
  it('surfaces a submit_plan prompt and resumes on approval', async () => {
    await runScenario({
      name: 'plan-approval',
      description: 'Agent submits a plan; the UI shows it; approving resumes and switches to build mode.',
      aimockFixture: 'plan-approval.json',
      run: async ({ driver }) => {
        await driver.switchMode('plan');
        await driver.submit('Propose a plan to add a README');

        const prompt = await driver.waitForSuspension();
        if (prompt.toolName !== 'submit_plan') throw new Error(`expected submit_plan, got ${prompt.toolName}`);

        await driver.respond({ action: 'approved' });

        // Approving a plan resumes the tool and transitions to the build
        // (default) mode — the observable effect of a plan-approval handoff.
        await waitFor(() => driver.state().modeId === 'build', 'mode to return to build');
      },
    });
  });
});

async function waitFor(probe: () => boolean, label: string, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!probe()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await new Promise(r => setTimeout(r, 25));
  }
}
