import { describe, expect, it } from 'vitest';

import { runScenario } from './scenario-runner';

/**
 * Plan approval is where a throughput readout goes wrong: the resume delivers a
 * tool-result `message_update` carrying no streamed text, immediately followed
 * by the `usage_update` of the original plan-generation step. A reader that
 * times a whole step's tokens against that gap reports tens of thousands of
 * tokens per second — the spike seen in production, and the TUI's own bug
 * before it grew a `hasAssistantText` guard.
 *
 * The web reading is measured on streamed text over windows of at least 250ms,
 * so the resume cannot produce a rate at all. This pins that at the level of
 * real SSE events rather than hand-built ones.
 */
describe('web scenario: plan-approval-tok-spike', () => {
  it('reports no impossible throughput across a plan-approval resume', async () => {
    await runScenario({
      name: 'plan-approval-tok-spike',
      description: 'Plan approval resume must not turn a tool-result message into a decode measurement.',
      aimockFixture: 'plan-approval-tok-spike.json',
      run: async ({ driver }) => {
        await driver.switchMode('plan');
        await driver.submit('Propose a tok/s spike reproduction plan');

        const prompt = await driver.waitForSuspension();
        if (prompt.toolName !== 'submit_plan') {
          throw new Error(`expected submit_plan, got ${prompt.toolName}`);
        }

        await driver.respond({ action: 'approved' });
        await driver.waitForText('Plan approved');
        await driver.waitForIdle();

        const { tokensPerSec, tokensPerSecHistory } = driver.runtime();

        expect(tokensPerSec).toBeLessThan(1000);
        expect(tokensPerSecHistory.every(rate => rate < 1000)).toBe(true);
      },
    });
  });
});
