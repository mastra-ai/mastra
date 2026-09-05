import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../request-context';
import { Session } from './session';

function createSession() {
  const session = new Session({ resourceId: 'r1', id: 's1', ownerId: 'o1' });
  session.emit({ type: 'agent_start' });
  return session;
}

function requestApproval(session: Session, toolCallId: string) {
  const toolName = 'write_file';
  const args = { path: `${toolCallId}.txt` };
  session.emit({ type: 'tool_start', toolCallId, toolName, args });
  const decision = session.approval.arm({ toolName, toolCallId });
  session.emit({ type: 'tool_approval_required', toolCallId, toolName, args });
  return decision;
}

function observeDisplay(session: Session) {
  const changed = vi.fn();
  session.subscribe(event => {
    if (event.type === 'display_state_changed') {
      // Copy the fields under test: the native snapshot remains mutable.
      changed({
        pendingApproval: event.displayState.pendingApproval,
        isRunning: event.displayState.isRunning,
        toolStatus: event.displayState.activeTools.get('t1')?.status,
      });
    }
  });
  return changed;
}

describe('Session approval display', () => {
  it.each(['approve', 'decline', 'always_allow_category'] as const)(
    'clears the prompt immediately after %s while preserving the running tool and decision',
    async decision => {
      const session = createSession();
      session.setCategoryResolver(() => 'edit');
      const approval = requestApproval(session, 't1');
      const changed = observeDisplay(session);
      const requestContext = new RequestContext();
      const declineContext = { reason: 'not needed', message: 'Skip this file' };

      session.respondToToolApproval({ decision, toolCallId: 't1', requestContext, declineContext });

      expect(session.approval.isArmed()).toBe(false);
      expect(session.displayState.get().pendingApproval).toBeNull();
      expect(changed).toHaveBeenCalledExactlyOnceWith({
        pendingApproval: null,
        isRunning: true,
        toolStatus: 'running',
      });
      await expect(approval).resolves.toEqual({
        decision: decision === 'decline' ? 'decline' : 'approve',
        requestContext,
        declineContext,
      });
      expect(session.hasCategoryGrant('edit')).toBe(decision === 'always_allow_category');

      session.emit({ type: 'tool_end', toolCallId: 't1', result: 'done', isError: false });
      expect(session.displayState.get().pendingApproval).toBeNull();
      expect(session.displayState.get().isRunning).toBe(true);
    },
  );

  it('accepts a response without an optional tool call id', async () => {
    const session = createSession();
    const approval = requestApproval(session, 't1');
    const changed = observeDisplay(session);

    session.respondToToolApproval({ decision: 'approve' });

    expect(session.displayState.get().pendingApproval).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);
    await expect(approval).resolves.toMatchObject({ decision: 'approve' });
  });

  it('does not clear a current prompt or grant a category for the wrong tool call id', async () => {
    const session = createSession();
    session.setCategoryResolver(() => 'edit');
    const approval = requestApproval(session, 't1');
    const changed = observeDisplay(session);

    session.respondToToolApproval({ decision: 'always_allow_category', toolCallId: 'stale' });

    expect(session.approval.isArmed()).toBe(true);
    expect(session.displayState.get().pendingApproval?.toolCallId).toBe('t1');
    expect(session.hasCategoryGrant('edit')).toBe(false);
    expect(changed).not.toHaveBeenCalled();

    session.respondToToolApproval({ decision: 'decline', toolCallId: 't1' });
    await expect(approval).resolves.toMatchObject({ decision: 'decline' });
  });

  it('does not emit another snapshot for a duplicate decision after the gate resolves', async () => {
    const session = createSession();
    const approval = requestApproval(session, 't1');
    session.respondToToolApproval({ decision: 'approve', toolCallId: 't1' });
    await approval;
    const changed = observeDisplay(session);

    session.respondToToolApproval({ decision: 'decline', toolCallId: 't1' });

    expect(session.displayState.get().pendingApproval).toBeNull();
    expect(changed).not.toHaveBeenCalled();
  });

  it('preserves the next queued approval when a stale response or prior tool result arrives', async () => {
    const session = createSession();
    const firstApproval = requestApproval(session, 't1');
    const changed = observeDisplay(session);
    let nextApproval: ReturnType<typeof requestApproval> | undefined;
    const nextRequested = firstApproval.then(() => {
      nextApproval = requestApproval(session, 't2');
    });

    session.respondToToolApproval({ decision: 'approve', toolCallId: 't1' });
    expect(changed).toHaveBeenCalledExactlyOnceWith({
      pendingApproval: null,
      isRunning: true,
      toolStatus: 'running',
    });
    await nextRequested;
    expect(session.displayState.get().pendingApproval?.toolCallId).toBe('t2');
    changed.mockClear();

    session.respondToToolApproval({ decision: 'decline', toolCallId: 't1' });
    expect(changed).not.toHaveBeenCalled();
    expect(session.approval.getToolCallId()).toBe('t2');
    session.emit({ type: 'tool_end', toolCallId: 't1', result: 'done', isError: false });
    expect(session.displayState.get().pendingApproval?.toolCallId).toBe('t2');

    session.respondToToolApproval({ decision: 'approve', toolCallId: 't2' });
    await expect(nextApproval).resolves.toMatchObject({ decision: 'approve' });
    expect(session.displayState.get().pendingApproval).toBeNull();
  });

  it.each(['complete', 'aborted', 'error', 'suspended'] as const)(
    'keeps terminal %s cleanup and later decisions from restoring an old prompt',
    async reason => {
      const session = createSession();
      const approval = requestApproval(session, 't1');

      session.emit({ type: 'agent_end', reason });
      expect(session.displayState.get().pendingApproval).toBeNull();
      expect(session.displayState.get().isRunning).toBe(false);
      session.respondToToolApproval({ decision: 'decline', toolCallId: 't1' });
      await approval;
      expect(session.displayState.get().pendingApproval).toBeNull();
      expect(session.displayState.get().isRunning).toBe(false);
    },
  );

  it('keeps a thread reset clear after an outstanding decision arrives', async () => {
    const session = createSession();
    const approval = requestApproval(session, 't1');

    session.emit({ type: 'thread_changed', threadId: 'new-thread', previousThreadId: 'old-thread' });
    expect(session.displayState.get().pendingApproval).toBeNull();
    expect(session.displayState.get().activeTools.size).toBe(0);
    session.respondToToolApproval({ decision: 'decline', toolCallId: 't1' });
    await approval;
    expect(session.displayState.get().pendingApproval).toBeNull();
    expect(session.displayState.get().activeTools.size).toBe(0);
  });
});
