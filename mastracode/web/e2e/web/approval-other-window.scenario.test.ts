import type { PlanResume } from '@mastra/client-js';
import { describe, it, expect } from 'vitest';

import { createDriver } from './driver';
import type { ScenarioDriver } from './driver';
import { runScenario } from './scenario-runner';

/**
 * Several windows watch one thread. Only the window that answers a prompt
 * dispatches a local resolvePrompt; every other window learns of the answer
 * from the event stream alone. Each must drop its card once the call settles,
 * not keep showing Approve/Decline next to the output that follows.
 */

type Window = ScenarioDriver;

function prompts(w: Window) {
  return w.state().entries.filter(e => e.kind === 'approval' || e.kind === 'suspension');
}

function twoWindows(
  name: string,
  server: { workspace?: boolean; yolo?: boolean } | undefined,
  run: (a: Window, b: Window, open: () => Promise<Window>) => Promise<void>,
) {
  const resourceId = `web-scenario-other-window-${name}`;
  return runScenario({
    name: `other-window-${name}`,
    description: 'A prompt answered in one window clears in the others.',
    aimockFixture: 'approval-other-window.json',
    resourceId,
    server,
    run: async ({ driver: a, baseUrl, fetch }) => {
      const opened: Window[] = [];
      const open = async () => {
        const w = await createDriver({ baseUrl, fetch, resourceId });
        opened.push(w);
        return w;
      };
      try {
        await run(a, await open(), open);
      } finally {
        await Promise.all(opened.map(w => w.dispose()));
      }
    },
  });
}

describe('web scenario: prompt answered in another window', () => {
  const approvals = { workspace: true, yolo: false };

  it('clears a tool approval approved in another window', () =>
    twoWindows('approve', approvals, async (a, b) => {
      await a.submit('Write approved.txt');
      await a.waitForApproval();
      expect((await b.waitForApproval()).toolCallId).toBe('call_write_ok');

      await a.approve(true);
      await b.waitForText('Wrote approved.txt');
      await b.waitForIdle();
      expect(prompts(b)).toEqual([]);
      expect(prompts(a)).toEqual([]);
    }));

  it('clears a tool approval declined in another window', () =>
    twoWindows('decline', approvals, async (a, b) => {
      await a.submit('Write declined.txt');
      await a.waitForApproval();
      await b.waitForApproval();

      await a.approve(false);
      await b.waitForText('Skipped declined.txt');
      await b.waitForIdle();
      expect(prompts(b)).toEqual([]);
    }));

  it('clears the card in the window that did not click when the second window answers', () =>
    twoWindows('reverse', approvals, async (a, b) => {
      await a.submit('Write approved.txt');
      await a.waitForApproval();
      await b.waitForApproval();

      await b.approve(true);
      await a.waitForText('Wrote approved.txt');
      await a.waitForIdle();
      expect(prompts(a)).toEqual([]);
    }));

  it('keeps the card in every window while nobody has answered', () =>
    twoWindows('unanswered', approvals, async (a, b) => {
      await a.submit('Write approved.txt');
      await a.waitForApproval();
      await b.waitForApproval();
      await new Promise(r => setTimeout(r, 300));
      expect(prompts(a).map(p => p.toolCallId)).toEqual(['call_write_ok']);
      expect(prompts(b).map(p => p.toolCallId)).toEqual(['call_write_ok']);
      await a.approve(true);
      await a.waitForIdle();
    }));

  for (const [label, message, resume, reply] of [
    ['approved', 'Plan to be approved', { action: 'approved' }, 'Building the approved plan'],
    ['rejected', 'Plan to be rejected', { action: 'rejected', feedback: 'Too broad' }, 'Revising the rejected plan'],
  ] as const) {
    it(`clears a plan card ${label} in another window`, () =>
      twoWindows(`plan-${label}`, undefined, async (a, b) => {
        await a.switchMode('plan');
        await a.submit(message);
        await a.waitForSuspension();
        expect((await b.waitForSuspension()).toolName).toBe('submit_plan');

        await a.respond(resume as PlanResume);
        await b.waitForText(reply);
        await b.waitForIdle();
        expect(prompts(b)).toEqual([]);
      }));
  }

  it('clears an ask_user question answered in another window', () =>
    twoWindows('ask-user', undefined, async (a, b) => {
      await a.submit('Ask me which environment');
      await a.waitForSuspension();
      expect((await b.waitForSuspension()).toolName).toBe('ask_user');

      await a.respond('Staging');
      await b.waitForText('Deploying to Staging');
      await b.waitForIdle();
      expect(prompts(b)).toEqual([]);
    }));
});
