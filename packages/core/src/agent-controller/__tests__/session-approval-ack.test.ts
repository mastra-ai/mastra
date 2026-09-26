import { describe, expect, it } from 'vitest';
import { SessionApproval, SessionSuspensions } from '../session';

// mastra-ai/mastra#24779: responders must report whether a pending target claimed the command.
describe('SessionApproval.respond result', () => {
  it('accepts the armed call and rejects stale, duplicate, and unarmed decisions', async () => {
    const approval = new SessionApproval();
    expect(approval.respond({ decision: 'approve' })).toEqual({ accepted: false, reason: 'not_pending' });

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

describe('SessionSuspensions.resolveToolCallId', () => {
  it('returns undefined when nothing is pending', () => {
    expect(new SessionSuspensions().resolveToolCallId('missing')).toBeUndefined();
  });

  it('does not treat an explicit empty id as omitted', () => {
    const suspensions = new SessionSuspensions();
    suspensions.register({ toolCallId: 'q-1', runId: 'run', toolName: 'ask_user', threadId: 't', resourceId: 'r' });
    expect(suspensions.resolveToolCallId('')).toBeUndefined();
    expect(suspensions.resolveToolCallId()).toBe('q-1');
  });
});
