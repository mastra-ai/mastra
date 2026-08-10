/**
 * Regression tests for #20398: input-request notifications must fire the moment
 * the event is received by the controller subscription listener, BEFORE the
 * event enters the TUI's serialized dispatch queue. A pending prompt blocks
 * that queue until the user answers, so a notification queued behind it would
 * be starved exactly when the user has walked away.
 *
 * These tests exercise the REAL subscription listener (subscribeToAgentController)
 * and the REAL display.notify / notifyForInputRequest mapping. Observation
 * happens one layer down, at the notify.js module boundary (sendNotification),
 * which display.ts calls through a cross-module import — the reliable
 * interception point. Events are delivered through the captured listener, never
 * via direct handleEvent calls, so the queue semantics are genuinely exercised.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
}));

vi.mock('../notify.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../notify.js')>()),
  sendNotification: mocks.sendNotification,
}));

import { subscribeToAgentController } from '../setup.js';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function createHarness() {
  let listener: ((event: any) => Promise<void>) | undefined;
  const state = {
    session: {
      state: { get: vi.fn(() => ({ notifications: 'off' })) },
      subscribe: vi.fn((handler: any) => {
        listener = handler;
        return vi.fn();
      }),
    },
    hookManager: undefined,
  } as any;

  const releaseBlocker = createDeferred<void>();
  const handled: string[] = [];
  const handleEvent = vi.fn(async (event: { type: string }) => {
    handled.push(`start:${event.type}`);
    if (event.type === 'blocking_prompt') {
      await releaseBlocker.promise;
    }
    handled.push(`end:${event.type}`);
  });

  subscribeToAgentController(state, handleEvent);
  if (!listener) throw new Error('subscribe did not capture a listener');

  return {
    state,
    listener: listener as (event: any) => Promise<void>,
    releaseBlocker,
    handled,
    handleEvent,
  };
}

beforeEach(() => {
  mocks.sendNotification.mockClear();
});

describe('input-request notifications fire at event receipt (#20398)', () => {
  it('notifies for ask_user while the queue is blocked by a pending prompt', async () => {
    const { listener, releaseBlocker, handled } = createHarness();

    const blocked = listener({ type: 'blocking_prompt' });
    await Promise.resolve();
    expect(handled).toEqual(['start:blocking_prompt']);

    const second = listener({
      type: 'tool_suspended',
      toolCallId: 't-ask',
      toolName: 'ask_user',
      suspendPayload: { question: 'Which option do you prefer?' },
    });

    // The queue is still blocked — the notification must already have fired.
    expect(handled).toEqual(['start:blocking_prompt']);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      'ask_question',
      expect.objectContaining({ message: 'Which option do you prefer?', mode: 'off' }),
    );

    // Releasing the queue preserves strict delivery order.
    releaseBlocker.resolve();
    await blocked;
    await second;
    expect(handled).toEqual([
      'start:blocking_prompt',
      'end:blocking_prompt',
      'start:tool_suspended',
      'end:tool_suspended',
    ]);
  });

  it('notifies for submit_plan while the queue is blocked', async () => {
    const { listener, releaseBlocker, handled } = createHarness();

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    void listener({
      type: 'tool_suspended',
      toolCallId: 't-plan',
      toolName: 'submit_plan',
      suspendPayload: { path: 'plans/my-plan.md' },
    });

    expect(handled).toEqual(['start:blocking_prompt']);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      'plan_approval',
      expect.objectContaining({ message: 'Plan "plans/my-plan.md" requires approval' }),
    );
    releaseBlocker.resolve();
  });

  it('falls back to a generic plan approval message when the payload has no path', async () => {
    const { listener, releaseBlocker } = createHarness();

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    void listener({
      type: 'tool_suspended',
      toolCallId: 't-plan-nopath',
      toolName: 'submit_plan',
      suspendPayload: {},
    });

    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      'plan_approval',
      expect.objectContaining({ message: 'Plan requires your approval' }),
    );
    releaseBlocker.resolve();
  });

  it('notifies for request_access by toolName while the queue is blocked', async () => {
    const { listener, releaseBlocker, handled } = createHarness();

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    void listener({
      type: 'tool_suspended',
      toolCallId: 't-sandbox',
      toolName: 'request_access',
      suspendPayload: { path: '/srv/data', reason: 'read datasets' },
    });

    expect(handled).toEqual(['start:blocking_prompt']);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      'sandbox_access',
      expect.objectContaining({ message: 'Sandbox access requested: /srv/data' }),
    );
    releaseBlocker.resolve();
  });

  it('notifies for a sandbox_access_request payload kind regardless of toolName', async () => {
    const { listener, releaseBlocker } = createHarness();

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    void listener({
      type: 'tool_suspended',
      toolCallId: 't-sandbox-kind',
      toolName: 'some_workspace_tool',
      suspendPayload: { kind: 'sandbox_access_request', path: '/opt/shared' },
    });

    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      'sandbox_access',
      expect.objectContaining({ message: 'Sandbox access requested: /opt/shared' }),
    );
    releaseBlocker.resolve();
  });

  it('notifies for tool_approval_required while the queue is blocked', async () => {
    const { listener, releaseBlocker, handled } = createHarness();

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    void listener({
      type: 'tool_approval_required',
      toolCallId: 't-approve',
      toolName: 'execute_command',
      args: { command: 'ls' },
    });

    expect(handled).toEqual(['start:blocking_prompt']);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      'tool_approval',
      expect.objectContaining({ message: 'Approve execute_command?' }),
    );
    releaseBlocker.resolve();
  });

  it('coerces a missing suspendPayload to an empty message instead of undefined', async () => {
    const { listener, releaseBlocker } = createHarness();

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    void listener({ type: 'tool_suspended', toolCallId: 't-bare', toolName: 'ask_user' });

    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith('ask_question', expect.objectContaining({ message: '' }));
    releaseBlocker.resolve();
  });

  it('does not notify for a tool_suspended event of an unrelated tool', async () => {
    const { listener, releaseBlocker } = createHarness();

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    void listener({
      type: 'tool_suspended',
      toolCallId: 't-other',
      toolName: 'some_other_tool',
      suspendPayload: { anything: true },
    });
    void listener({ type: 'message_update' });

    expect(mocks.sendNotification).not.toHaveBeenCalled();
    releaseBlocker.resolve();
  });

  it('notifies agent_done at receipt for agent_end reason complete while the queue is blocked (#20860)', async () => {
    const { listener, releaseBlocker, handled } = createHarness();

    const blocked = listener({ type: 'blocking_prompt' });
    await Promise.resolve();
    expect(handled).toEqual(['start:blocking_prompt']);

    const second = listener({ type: 'agent_end', reason: 'complete' });

    // The queue is still blocked — the completion ping must already have fired.
    expect(handled).toEqual(['start:blocking_prompt']);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith('agent_done', expect.objectContaining({ mode: 'off' }));
    // Reason only, no message — parity with the old queued call shape; the
    // default 'Agent finished' text comes from reasonToMessage in notify.ts.
    expect(mocks.sendNotification.mock.calls[0]?.[1]?.message).toBeUndefined();

    releaseBlocker.resolve();
    await blocked;
    await second;
    expect(handled).toEqual(['start:blocking_prompt', 'end:blocking_prompt', 'start:agent_end', 'end:agent_end']);
  });

  it('notifies agent_done at receipt when agent_end carries no reason (#20860)', async () => {
    const { listener, releaseBlocker } = createHarness();

    void listener({ type: 'blocking_prompt' });
    await Promise.resolve();

    void listener({ type: 'agent_end' });

    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith('agent_done', expect.anything());
    releaseBlocker.resolve();
  });

  // Scope note: this harness uses a fake handleEvent, so these cases observe
  // only the receipt-time tap. The removal of the queued handler's notify is
  // pinned separately in mastra-tui-queueing.test.ts.
  it.each(['suspended', 'aborted', 'error'] as const)(
    'does not notify agent_done at receipt for agent_end reason %s (#20860)',
    async reason => {
      const { listener, releaseBlocker } = createHarness();

      void listener({ type: 'blocking_prompt' });
      await Promise.resolve();

      void listener({ type: 'agent_end', reason });

      expect(mocks.sendNotification).not.toHaveBeenCalled();
      releaseBlocker.resolve();
    },
  );

  it('keeps delivering events when notification state access throws', async () => {
    let listener: ((event: any) => Promise<void>) | undefined;
    const poisonedState = {
      session: {
        state: {
          get: vi.fn(() => {
            throw new Error('poisoned state');
          }),
        },
        subscribe: vi.fn((handler: any) => {
          listener = handler;
          return vi.fn();
        }),
      },
      hookManager: undefined,
    } as any;
    const handled: string[] = [];
    const handleEvent = vi.fn(async (event: { type: string }) => {
      handled.push(event.type);
    });
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    let stderrOutput: string[] = [];

    try {
      subscribeToAgentController(poisonedState, handleEvent);
      const delivery = listener!({
        type: 'tool_suspended',
        toolCallId: 't-poison',
        toolName: 'ask_user',
        suspendPayload: { question: 'still delivered?' },
      });
      await delivery;
    } finally {
      stderrOutput = stderrSpy.mock.calls.map(args => String(args[0]));
      stderrSpy.mockRestore();
    }

    expect(handled).toEqual(['tool_suspended']);
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(stderrOutput.join('')).toContain('[notify error] poisoned state');
  });
});
