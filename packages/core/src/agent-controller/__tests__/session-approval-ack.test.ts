import { describe, expect, it } from 'vitest';
import { SessionApproval, SessionSuspensions } from '../session';

// mastra-ai/mastra#24779: responders must report whether a pending target claimed the command.
describe('SessionApproval.respond result', () => {
  it('accepts the armed call and rejects stale, duplicate, and unarmed decisions', async () => {
    const approval = new SessionApproval();
    expect(approval.respond({ decision: 'approve', toolCallId: 'current' })).toEqual({
      accepted: false,
      reason: 'not_pending',
    });

    const decision = approval.arm({ toolName: 'write_file', toolCallId: 'current' });
    expect(approval.respond({ decision: 'approve', toolCallId: 'stale' })).toEqual({
      accepted: false,
      reason: 'stale_tool_call',
    });
    expect(approval.isArmed()).toBe(true);

    expect(approval.respond({ decision: 'approve', toolCallId: 'current' })).toEqual({ accepted: true });
    await expect(decision).resolves.toMatchObject({ decision: 'approve' });

    expect(approval.respond({ decision: 'approve', toolCallId: 'current' })).toEqual({
      accepted: false,
      reason: 'not_pending',
    });
  });
});

describe('SessionSuspensions.resolveAddress', () => {
  it('returns undefined when nothing is pending', () => {
    expect(new SessionSuspensions().resolveAddress({ toolCallId: 'missing' })).toBeUndefined();
  });

  it('does not treat an explicit empty id as omitted', () => {
    const suspensions = new SessionSuspensions();
    suspensions.register({ toolCallId: 'q-1', runId: 'run', toolName: 'ask_user', threadId: 't', resourceId: 'r' });
    expect(suspensions.resolveAddress({ toolCallId: '' })).toBeUndefined();
    expect(suspensions.resolveAddress()).toEqual({
      threadId: 't',
      resourceId: 'r',
      runId: 'run',
      toolCallId: 'q-1',
    });
  });

  it('keeps delimiter-containing addresses distinct', () => {
    const suspensions = new SessionSuspensions();
    const first = { resourceId: 'r\0t', threadId: '', runId: 'run', toolCallId: 'call' };
    const second = { resourceId: 'r', threadId: '\0t', runId: 'run', toolCallId: 'call' };
    suspensions.register({ ...first, toolName: 'first' });
    suspensions.register({ ...second, toolName: 'second' });

    expect(suspensions.get(first)?.toolName).toBe('first');
    expect(suspensions.get(second)?.toolName).toBe('second');
  });

  it('rejects an ambiguous tool call id and resolves it with a run id', () => {
    const suspensions = new SessionSuspensions(() => ({ resourceId: 'r', threadId: 't' }));
    suspensions.register({ toolCallId: 'q-1', runId: 'run-a', toolName: 'ask_user', threadId: 't', resourceId: 'r' });
    suspensions.register({ toolCallId: 'q-1', runId: 'run-b', toolName: 'ask_user', threadId: 't', resourceId: 'r' });
    suspensions.register({
      toolCallId: 'q-1',
      runId: 'run-c',
      toolName: 'ask_user',
      threadId: 't',
      resourceId: 'other-resource',
    });

    expect(suspensions.resolveAddress({ toolCallId: 'q-1' })).toBeUndefined();
    const address = suspensions.resolveAddress({ toolCallId: 'q-1', runId: 'run-b' });
    expect(address).toEqual({ threadId: 't', resourceId: 'r', runId: 'run-b', toolCallId: 'q-1' });
    expect(suspensions.get({ ...address!, resourceId: 'other-resource' })).toBeUndefined();

    suspensions.delete(address!);
    expect(suspensions.resolveAddress({ toolCallId: 'q-1' })).toEqual({
      threadId: 't',
      resourceId: 'r',
      runId: 'run-a',
      toolCallId: 'q-1',
    });
  });
});
