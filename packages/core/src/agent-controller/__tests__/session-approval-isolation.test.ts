import { describe, expect, it } from 'vitest';

import { SessionApproval } from '../session';

describe('SessionApproval isolation', () => {
  it('keeps concurrent gates for different calls independent', async () => {
    const approval = new SessionApproval();
    const first = approval.arm({
      toolName: 'write_file',
      toolCallId: 'call-a',
      threadId: 'thread-a',
      runId: 'run-a',
    });
    const second = approval.arm({
      toolName: 'execute_command',
      toolCallId: 'call-b',
      threadId: 'thread-b',
      runId: 'run-b',
    });

    expect(approval.getToolCallIds().sort()).toEqual(['call-a', 'call-b']);

    approval.respond({ decision: 'approve', toolCallId: 'call-a' });
    await expect(first).resolves.toEqual(expect.objectContaining({ decision: 'approve' }));

    // Resolving one gate must leave the other parked.
    expect(approval.isArmed({ toolCallId: 'call-b' })).toBe(true);
    let secondSettled = false;
    void second.then(() => {
      secondSettled = true;
    });
    await Promise.resolve();
    expect(secondSettled).toBe(false);

    approval.respond({ decision: 'decline', toolCallId: 'call-b' });
    await expect(second).resolves.toEqual(expect.objectContaining({ decision: 'decline' }));
    expect(approval.isArmed()).toBe(false);
  });

  it.each(['different-thread', 'different-run'] as const)(
    'rejects an ambiguous call ID without releasing either owner: %s',
    async variant => {
      const approval = new SessionApproval();
      const source = { toolName: 'write_file', toolCallId: 'shared-call', threadId: 'a', runId: 'run-a' };
      const active = { ...source, threadId: variant === 'different-thread' ? 'b' : 'a', runId: 'run-b' };
      const first = approval.arm(source);
      const second = approval.arm(active);
      expect(first).not.toBe(second);
      expect(approval.arm(source)).toBe(first);
      let settled = 0;
      void first.then(() => {
        settled++;
      });
      void second.then(() => {
        settled++;
      });
      let grants = 0;
      expect(
        approval.respond({
          decision: 'always_allow_category',
          toolCallId: 'shared-call',
          onAlwaysAllow: () => {
            grants++;
          },
        }),
      ).toEqual({ accepted: false, reason: 'stale_tool_call' });
      await Promise.resolve();
      expect(settled).toBe(0);
      expect(grants).toBe(0);
      expect(approval.isArmed(source)).toBe(true);
      expect(approval.isArmed(active)).toBe(true);
      approval.cancel({ threadId: source.threadId, runId: source.runId });
      await expect(first).resolves.toMatchObject({ decision: 'decline' });
      expect(approval.isArmed(active)).toBe(true);
      expect(approval.respond({ decision: 'approve', toolCallId: 'shared-call' })).toEqual({ accepted: true });
      await expect(second).resolves.toMatchObject({ decision: 'approve' });
      expect(approval.isArmed()).toBe(false);
    },
  );

  it('re-arms the same call onto the parked gate instead of stranding it', async () => {
    const approval = new SessionApproval();
    const first = approval.arm({ toolName: 'write_file', toolCallId: 'call-a' });
    const second = approval.arm({ toolName: 'write_file', toolCallId: 'call-a' });

    expect(approval.getToolCallIds()).toEqual(['call-a']);

    approval.respond({ decision: 'approve', toolCallId: 'call-a' });

    await expect(first).resolves.toEqual(expect.objectContaining({ decision: 'approve' }));
    await expect(second).resolves.toEqual(expect.objectContaining({ decision: 'approve' }));
  });

  it('ignores a response whose toolCallId names no parked gate', async () => {
    const approval = new SessionApproval();
    const parked = approval.arm({ toolName: 'write_file', toolCallId: 'call-a' });

    approval.respond({ decision: 'approve', toolCallId: 'call-stale' });

    expect(approval.isArmed({ toolCallId: 'call-a' })).toBe(true);
    let settled = false;
    void parked.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it('cancels only the gates matching the requested thread', async () => {
    const approval = new SessionApproval();
    const current = approval.arm({ toolName: 'write_file', toolCallId: 'call-current', threadId: 'thread-a' });
    const background = approval.arm({ toolName: 'write_file', toolCallId: 'call-background', threadId: 'thread-b' });

    expect(approval.cancel({ threadId: 'thread-a' })).toEqual(['call-current']);

    await expect(current).resolves.toEqual(expect.objectContaining({ decision: 'decline' }));
    expect(approval.isArmed({ threadId: 'thread-a' })).toBe(false);
    expect(approval.isArmed({ threadId: 'thread-b' })).toBe(true);

    approval.cancel({ threadId: 'thread-b' });
    await expect(background).resolves.toEqual(expect.objectContaining({ decision: 'decline' }));
  });

  it('cancels only the gates matching the requested run', async () => {
    const approval = new SessionApproval();
    const first = approval.arm({
      toolName: 'write_file',
      toolCallId: 'call-1',
      threadId: 'thread-a',
      runId: 'run-1',
    });
    void approval.arm({ toolName: 'write_file', toolCallId: 'call-2', threadId: 'thread-a', runId: 'run-2' });

    expect(approval.cancel({ runId: 'run-1' })).toEqual(['call-1']);

    await expect(first).resolves.toEqual(expect.objectContaining({ decision: 'decline' }));
    expect(approval.isArmed({ runId: 'run-2' })).toBe(true);
  });

  it('releases an untagged gate even when a scoped cancel targets one thread', async () => {
    // A gate whose producer never recorded a thread cannot be attributed to a
    // *different* thread, so a scoped cancel releases it rather than stranding
    // the run waiting on it.
    const approval = new SessionApproval();
    const parked = approval.arm({ toolName: 'write_file', toolCallId: 'call-untagged' });

    expect(approval.cancel({ threadId: 'thread-a' })).toEqual(['call-untagged']);
    await expect(parked).resolves.toEqual(expect.objectContaining({ decision: 'decline' }));
  });

  it('releases only untagged gates when the caller names a thread it does not have', async () => {
    // An abort with no thread binding must not decline a detached thread's gate,
    // so `{ threadId: undefined }` selects the untagged gates instead of every
    // gate — mirroring the scoped case above for callers with no thread id.
    const approval = new SessionApproval();
    void approval.arm({ toolName: 'write_file', toolCallId: 'call-tagged', threadId: 'thread-b' });
    const untagged = approval.arm({ toolName: 'write_file', toolCallId: 'call-untagged' });

    expect(approval.isArmed({ threadId: undefined })).toBe(true);
    expect(approval.cancel({ threadId: undefined })).toEqual(['call-untagged']);

    await expect(untagged).resolves.toEqual(expect.objectContaining({ decision: 'decline' }));
    expect(approval.isArmed({ toolCallId: 'call-tagged' })).toBe(true);
  });

  it('releases every gate when cancelled without a filter', async () => {
    const approval = new SessionApproval();
    const first = approval.arm({ toolName: 'write_file', toolCallId: 'call-1', threadId: 'thread-a' });
    const second = approval.arm({ toolName: 'write_file', toolCallId: 'call-2', threadId: 'thread-b' });

    expect(approval.cancel({ declineContext: { reason: 'aborted' } }).sort()).toEqual(['call-1', 'call-2']);

    await expect(first).resolves.toEqual(expect.objectContaining({ decision: 'decline' }));
    await expect(second).resolves.toEqual(expect.objectContaining({ decision: 'decline' }));
    expect(approval.isArmed()).toBe(false);
  });
});
