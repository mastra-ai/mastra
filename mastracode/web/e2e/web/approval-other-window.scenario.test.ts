import { describe, it, expect } from 'vitest';

import { createDriver } from './driver';
import { runScenario } from './scenario-runner';

/**
 * Two windows watch one thread. Window A answers a tool approval; window B
 * never clicked, so it only learns of the answer from the event stream. B must
 * drop its approval card once the call runs, not keep showing Approve/Decline
 * next to the output that follows it.
 */
describe('web scenario: approval answered in another window', () => {
  it('clears the approval card in a second window once the call runs', async () => {
    const resourceId = 'web-scenario-approval-other-window';
    await runScenario({
      name: 'approval-other-window',
      description: 'A tool approval answered in one window clears in the other.',
      aimockFixture: 'tool-approval.json',
      resourceId,
      server: { workspace: true, yolo: false },
      run: async ({ driver: windowA, baseUrl, fetch }) => {
        const windowB = await createDriver({ baseUrl, fetch, resourceId });
        try {
          await windowA.submit('Write notes.txt with the text draft');

          await windowA.waitForApproval();
          const promptB = await windowB.waitForApproval();
          expect(promptB.toolName).toBe('mastra_workspace_write_file');

          await windowA.approve(true);
          await windowB.waitForText('Wrote notes.txt');
          await windowB.waitForIdle();

          expect(windowB.state().entries.filter(e => e.kind === 'approval')).toEqual([]);
        } finally {
          await windowB.dispose();
        }
      },
    });
  });

  it('clears the plan card in a second window once the plan is approved', async () => {
    const resourceId = 'web-scenario-plan-other-window';
    await runScenario({
      name: 'plan-other-window',
      description: 'A plan approved in one window clears in the other.',
      aimockFixture: 'plan-approval.json',
      resourceId,
      run: async ({ driver: windowA, baseUrl, fetch }) => {
        const windowB = await createDriver({ baseUrl, fetch, resourceId });
        try {
          await windowA.switchMode('plan');
          await windowA.submit('Propose a plan to add a README');

          await windowA.waitForSuspension();
          const promptB = await windowB.waitForSuspension();
          expect(promptB.toolName).toBe('submit_plan');

          await windowA.respond({ action: 'approved' });
          await windowB.waitForIdle();

          expect(windowB.state().entries.filter(e => e.kind === 'suspension')).toEqual([]);
        } finally {
          await windowB.dispose();
        }
      },
    });
  });
});
