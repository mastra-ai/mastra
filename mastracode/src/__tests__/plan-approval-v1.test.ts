import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { createRealV1Harness } from '../test-utils/real-v1-harness.js';

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
});

const planModes = [
  { id: 'build', defaultModelId: 'mock-model', description: 'Build' },
  { id: 'plan', defaultModelId: 'mock-model', description: 'Plan', transitionsTo: 'build' },
];

describe('v1 plan approval boundary (real harness)', () => {
  it('emits pending_item_registered and blocks until respondToPlanApproval approves', async () => {
    const { harness, cleanup } = createRealV1Harness({ modes: planModes, defaultModeId: 'plan' });
    cleanups.push(cleanup);
    await harness.init();
    const session = await harness.session({ threadId: 'thread-plan', resourceId: 'res-plan' });

    const registered: Array<{ kind: string; id: string }> = [];
    harness.subscribe(event => {
      if (event.type === 'pending_item_registered') {
        registered.push({ kind: event.item.kind, id: event.item.id });
      }
    });

    const pending = await session.registerPendingItem({
      id: randomUUID(),
      kind: 'plan-approval',
      status: 'pending',
      payload: { title: 'Test plan', plan: '1. do the thing', transitionModeId: session.getMode().transitionsTo },
    });

    expect(registered).toEqual([{ kind: 'plan-approval', id: pending.id }]);

    const boundary = session.waitForPendingResponse(pending.id);
    let settled = false;
    void boundary.then(() => {
      settled = true;
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(settled).toBe(false); // blocked until the user responds

    await session.respondToPlanApproval(pending.id, { approved: true });

    const response = await boundary;
    expect(response.approved).toBe(true);
    // transitionsTo froze plan→build; approval flips the session mode.
    expect(session.getMode().id).toBe('build');
    expect(session.listPendingItems().find(item => item.id === pending.id)?.status).toBe('responded');
  });

  it('resolves the boundary with feedback on rejection and stays in plan mode', async () => {
    const { harness, cleanup } = createRealV1Harness({ modes: planModes, defaultModeId: 'plan' });
    cleanups.push(cleanup);
    await harness.init();
    const session = await harness.session({ threadId: 'thread-reject', resourceId: 'res-reject' });

    const pending = await session.registerPendingItem({
      id: randomUUID(),
      kind: 'plan-approval',
      status: 'pending',
      payload: { title: 'Test plan', plan: '1. do the thing', transitionModeId: session.getMode().transitionsTo },
    });

    const boundary = session.waitForPendingResponse(pending.id);
    await session.respondToPlanApproval(pending.id, { approved: false, feedback: 'tighten step 1' });

    const response = await boundary;
    expect(response.approved).toBe(false);
    expect(response.feedback).toBe('tighten step 1');
    expect(session.getMode().id).toBe('plan');
  });

  it('rejects the boundary when the abort signal fires while waiting', async () => {
    const { harness, cleanup } = createRealV1Harness({ modes: planModes, defaultModeId: 'plan' });
    cleanups.push(cleanup);
    await harness.init();
    const session = await harness.session({ threadId: 'thread-abort', resourceId: 'res-abort' });

    const pending = await session.registerPendingItem({
      id: randomUUID(),
      kind: 'plan-approval',
      status: 'pending',
      payload: { title: 'Test plan', plan: '1. do the thing' },
    });

    const controller = new AbortController();
    const boundary = session.waitForPendingResponse(pending.id, { abortSignal: controller.signal });
    controller.abort();

    await expect(boundary).rejects.toMatchObject({ name: 'AbortError' });
  });
});
