import { describe, expect, it, vi } from 'vitest';
import { Session } from '../session';

function fixture() {
  const sendToolApproval = vi.fn(async () => {});
  const saved = {
    runId: 'saved-run',
    toolCalls: [{ toolCallId: 'saved-call', toolName: 'fixture', requiresApproval: true, args: { value: 'saved' } }],
  };
  const agent = { id: 'agent', listSuspendedRuns: vi.fn(async () => ({ runs: [saved], total: 1 })), sendToolApproval };
  const session = new Session({ id: 'session', ownerId: 'owner', resourceId: 'resource' });
  const context = {};
  session.setMachinery({
    getAgent: () => agent,
    buildRequestContext: async () => context,
    buildToolsets: async () => ({}),
  } as any);
  session.thread.set({ threadId: 'thread' });
  const subscription = { unsubscribe: vi.fn(), activeRunId: () => null } as any;
  session.stream.attach({ key: 'key', subscription });
  return { session, agent, saved, sendToolApproval, context, subscription };
}

describe('saved Session approvals', () => {
  it.each(['approve', 'decline'] as const)(
    'restores the prompt without execution and delivers %s exactly once',
    async decision => {
      const f = fixture();
      await f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
      expect(f.agent.listSuspendedRuns).toHaveBeenCalledWith({ threadId: 'thread', resourceId: 'resource' });
      expect(f.session.displayState.get().pendingApproval).toEqual({
        toolCallId: 'saved-call',
        toolName: 'fixture',
        args: { value: 'saved' },
      });
      expect(f.sendToolApproval).not.toHaveBeenCalled();
      f.session.respondToToolApproval({ decision: 'approve', toolCallId: 'stale-call' });
      expect(f.session.approval.isArmed()).toBe(true);
      f.session.respondToToolApproval({ decision, toolCallId: 'saved-call' });
      f.session.respondToToolApproval({ decision: 'approve', toolCallId: 'saved-call' });
      await vi.waitFor(() => expect(f.sendToolApproval).toHaveBeenCalledTimes(1));
      expect(f.sendToolApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'saved-run',
          toolCallId: 'saved-call',
          threadId: 'thread',
          resourceId: 'resource',
          approved: decision === 'approve',
          requestContext: f.context,
        }),
      );
      expect(f.session.displayState.get().pendingApproval).toBeNull();
    },
  );

  it('does not restore or execute an ordinary tool suspension as an approval', async () => {
    const f = fixture();
    f.saved.toolCalls[0].requiresApproval = false;
    await f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    expect(f.session.displayState.get().pendingApproval).toBeNull();
    f.session.respondToToolApproval({ decision: 'approve' });
    expect(f.sendToolApproval).not.toHaveBeenCalled();
  });

  it('does not choose arbitrarily between multiple saved approvals', async () => {
    const f = fixture();
    f.saved.toolCalls.push({ ...f.saved.toolCalls[0], toolCallId: 'other-call' });
    await expect(
      f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription }),
    ).rejects.toThrow('Multiple saved approvals');
    expect(f.sendToolApproval).not.toHaveBeenCalled();
    expect(f.session.approval.isArmed()).toBe(false);
  });

  it('does not let navigation during discovery restore a prompt on the next thread', async () => {
    const f = fixture();
    let finish!: (value: any) => void;
    f.agent.listSuspendedRuns.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const restore = f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    f.session.thread.set({ threadId: 'next-thread' });
    finish({ runs: [f.saved], total: 1 });
    await restore;
    expect(f.session.displayState.get().pendingApproval).toBeNull();
    expect(f.sendToolApproval).not.toHaveBeenCalled();
  });

  it('does not execute a response racing navigation during context resolution', async () => {
    const f = fixture();
    let finish!: () => void;
    f.session.setMachinery({
      getAgent: () => f.agent,
      buildRequestContext: () =>
        new Promise(resolve => {
          finish = () => resolve(f.context);
        }),
      buildToolsets: async () => ({}),
    } as any);
    await f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    f.session.respondToToolApproval({ decision: 'approve' });
    f.session.thread.set({ threadId: 'next-thread' });
    finish();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.sendToolApproval).not.toHaveBeenCalled();
  });

  it('leaves a live approval gate untouched', async () => {
    const f = fixture();
    void f.session.approval.arm({ toolCallId: 'live', toolName: 'fixture' });
    await f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    expect(f.agent.listSuspendedRuns).not.toHaveBeenCalled();
    expect(f.session.approval.getToolCallId()).toBe('live');
    f.session.approval.cancel();
  });

  it('does not publish an old response failure onto another thread', async () => {
    const f = fixture();
    const events: unknown[] = [];
    let fail!: (error: Error) => void;
    f.sendToolApproval.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    await f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    f.session.subscribe(event => events.push(event));
    f.session.respondToToolApproval({ decision: 'approve', toolCallId: 'saved-call' });
    await vi.waitFor(() => expect(f.sendToolApproval).toHaveBeenCalledTimes(1));
    f.session.thread.set({ threadId: 'next-thread' });
    fail(new Error('Old run failed'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'error' }));
    expect(f.agent.listSuspendedRuns).toHaveBeenCalledTimes(1);
  });

  it('keeps saved work waiting when a new message is sent before its decision', async () => {
    const f = fixture();
    vi.spyOn(f.session.thread, 'ensureSubscription').mockResolvedValue();
    await f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    await expect(f.session.sendSignal({ content: 'Another message' }).accepted).rejects.toThrow(
      'Respond to the saved tool approval',
    );
    expect(f.session.approval.isArmed()).toBe(true);
    expect(f.session.displayState.get().pendingApproval?.toolCallId).toBe('saved-call');
    expect(f.sendToolApproval).not.toHaveBeenCalled();
  });

  it('restores the saved prompt after a failed response without retrying the decision', async () => {
    const f = fixture();
    const events: unknown[] = [];
    f.session.subscribe(event => events.push(event));
    f.sendToolApproval.mockRejectedValueOnce(new Error('Storage unavailable'));
    await f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    f.session.respondToToolApproval({ decision: 'approve', toolCallId: 'saved-call' });
    await vi.waitFor(() => expect(f.session.approval.isArmed()).toBe(true));
    expect(f.sendToolApproval).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'error' }));
    expect(f.session.displayState.get().pendingApproval?.toolCallId).toBe('saved-call');
    f.session.respondToToolApproval({ decision: 'decline', toolCallId: 'saved-call' });
    await vi.waitFor(() => expect(f.sendToolApproval).toHaveBeenCalledTimes(2));
    expect(f.sendToolApproval).toHaveBeenLastCalledWith(expect.objectContaining({ approved: false }));
  });

  it('rejects another message while the recovered decision is still being delivered', async () => {
    const f = fixture();
    vi.spyOn(f.session.thread, 'ensureSubscription').mockResolvedValue();
    let finish!: () => void;
    f.sendToolApproval.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    await f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    f.session.respondToToolApproval({ decision: 'approve', toolCallId: 'saved-call' });
    await vi.waitFor(() => expect(f.sendToolApproval).toHaveBeenCalledTimes(1));
    await expect(f.session.sendSignal({ content: 'Another message' }).accepted).rejects.toThrow(
      'Respond to the saved tool approval',
    );
    finish();
    await vi.waitFor(() => expect(f.session.approval.isRestored()).toBe(false));
  });

  it('rejects a stale discovery after reconnecting to the same thread', async () => {
    const f = fixture();
    let finish!: (value: any) => void;
    f.agent.listSuspendedRuns.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const restore = f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription });
    f.session.stream.attach({ key: 'key', subscription: { unsubscribe: vi.fn(), activeRunId: () => null } as any });
    finish({ runs: [f.saved], total: 1 });
    await restore;
    expect(f.session.approval.isArmed()).toBe(false);
    expect(f.sendToolApproval).not.toHaveBeenCalled();
  });

  it('propagates storage failure without inventing an empty approval state', async () => {
    const f = fixture();
    f.agent.listSuspendedRuns.mockRejectedValue(new Error('Storage unavailable'));
    await expect(
      f.session.restorePendingApproval({ threadId: 'thread', subscription: f.subscription }),
    ).rejects.toThrow('Storage unavailable');
    expect(f.sendToolApproval).not.toHaveBeenCalled();
  });
});
