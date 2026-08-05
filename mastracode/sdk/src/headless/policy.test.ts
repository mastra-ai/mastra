import { describe, it, expect } from 'vitest';

import { autoApprovePolicy, denyPolicy, permissionModeToPolicy } from './policy.js';

type ApprovalEvent = Parameters<typeof autoApprovePolicy.onToolApproval>[0];
type SuspensionEvent = Parameters<typeof autoApprovePolicy.onSuspension>[0];

function approval(overrides: Partial<ApprovalEvent> = {}): ApprovalEvent {
  return { type: 'tool_approval_required', toolCallId: 'call-1', toolName: 'shell', ...overrides } as ApprovalEvent;
}

function suspension(overrides: Partial<SuspensionEvent> = {}): SuspensionEvent {
  return { type: 'tool_suspended', toolCallId: 'call-1', toolName: 'ask_user', ...overrides } as SuspensionEvent;
}

describe('autoApprovePolicy', () => {
  it('approves every tool approval request', () => {
    expect(autoApprovePolicy.onToolApproval(approval())).toBe('approve');
    expect(autoApprovePolicy.onToolApproval(approval({ toolName: 'write_file' }))).toBe('approve');
  });

  it('auto-approves request_access suspensions with "Yes"', () => {
    expect(autoApprovePolicy.onSuspension(suspension({ toolName: 'request_access' }))).toEqual({ resumeData: 'Yes' });
  });

  it('auto-approves sandbox_access_request suspensions by payload kind', () => {
    const event = suspension({ toolName: 'something', suspendPayload: { kind: 'sandbox_access_request' } });
    expect(autoApprovePolicy.onSuspension(event)).toEqual({ resumeData: 'Yes' });
  });

  it('auto-approves submit_plan suspensions', () => {
    expect(autoApprovePolicy.onSuspension(suspension({ toolName: 'submit_plan' }))).toEqual({
      resumeData: { action: 'approved' },
    });
  });

  it('answers other suspensions with a best-judgment instruction', () => {
    const outcome = autoApprovePolicy.onSuspension(suspension({ toolName: 'ask_user' }));
    expect(outcome).toEqual({ resumeData: 'Proceed with your best judgment. Do not ask further questions.' });
  });

  it('tolerates a missing suspendPayload', () => {
    const outcome = autoApprovePolicy.onSuspension(suspension({ toolName: 'ask_user', suspendPayload: undefined }));
    expect(outcome).toEqual({ resumeData: 'Proceed with your best judgment. Do not ask further questions.' });
  });
});

describe('denyPolicy', () => {
  it('denies every tool approval request', () => {
    expect(denyPolicy.onToolApproval(approval())).toBe('deny');
    expect(denyPolicy.onToolApproval(approval({ toolName: 'read_file' }))).toBe('deny');
  });

  it('aborts on any suspension', () => {
    expect(denyPolicy.onSuspension(suspension({ toolName: 'request_access' }))).toEqual({ abort: true });
    expect(denyPolicy.onSuspension(suspension({ toolName: 'submit_plan' }))).toEqual({ abort: true });
    expect(denyPolicy.onSuspension(suspension({ toolName: 'ask_user' }))).toEqual({ abort: true });
  });
});

describe('permissionModeToPolicy', () => {
  it('maps "auto" to autoApprovePolicy', () => {
    expect(permissionModeToPolicy('auto')).toBe(autoApprovePolicy);
  });

  it('maps "deny" to denyPolicy', () => {
    expect(permissionModeToPolicy('deny')).toBe(denyPolicy);
  });
});
