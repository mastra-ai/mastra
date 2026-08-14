import { describe, expect, it } from 'vitest';
import { resolveApprovalPersistenceMode } from './approval-persistence';

describe('resolveApprovalPersistenceMode', () => {
  it('defaults to full persistence', () => {
    expect(resolveApprovalPersistenceMode(undefined)).toBe('full');
  });

  it.each(['full', 'minimal'] as const)('accepts %s persistence', mode => {
    expect(resolveApprovalPersistenceMode(mode)).toBe(mode);
  });

  it.each([null, true, 'compact', 1])('rejects invalid persistence value %j', value => {
    expect(() => resolveApprovalPersistenceMode(value)).toThrow(
      `Invalid approvalPersistence value "${String(value)}". Expected "full" or "minimal".`,
    );
  });
});
