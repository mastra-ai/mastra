import { describe, expect, it } from 'vitest';
import { isToolApprovalPending } from '../tool-action-state';

describe('isToolApprovalPending', () => {
  describe('when approval metadata is missing', () => {
    it('does not require the tool disclosure to open', () => {
      expect(isToolApprovalPending(undefined, false)).toBe(false);
    });
  });

  describe('when an uncalled tool has approval metadata', () => {
    it('requires the tool disclosure to open', () => {
      expect(isToolApprovalPending({ toolCallId: 'call-1' }, false)).toBe(true);
    });
  });

  describe('when the tool has already been called', () => {
    it('does not require the tool disclosure to open again', () => {
      expect(isToolApprovalPending({ toolCallId: 'call-1' }, true)).toBe(false);
    });
  });
});
