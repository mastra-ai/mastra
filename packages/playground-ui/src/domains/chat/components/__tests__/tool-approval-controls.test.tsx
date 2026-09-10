// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToolApprovalControls } from '../tool-approval-controls';

afterEach(cleanup);

describe('ToolApprovalControls', () => {
  describe('when no action callbacks are provided', () => {
    it('keeps the approval request visible without executable actions', () => {
      render(<ToolApprovalControls isRunning={false} />);
      expect(screen.getByText('Approval required')).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('when only approval is available', () => {
    it('delegates approval without exposing refusal', () => {
      const onApprove = vi.fn();
      render(<ToolApprovalControls isRunning={false} onApprove={onApprove} />);
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      expect(onApprove).toHaveBeenCalledExactlyOnceWith();
      expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    });
  });

  describe('when only refusal is available', () => {
    it('delegates refusal without exposing approval', () => {
      const onDecline = vi.fn();
      render(<ToolApprovalControls isRunning={false} onDecline={onDecline} />);
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(onDecline).toHaveBeenCalledExactlyOnceWith();
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });
  });

  describe('when the agent is running', () => {
    it('prevents submitting a decision', () => {
      const onApprove = vi.fn();
      const onDecline = vi.fn();
      render(<ToolApprovalControls isRunning onApprove={onApprove} onDecline={onDecline} />);
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(onApprove).not.toHaveBeenCalled();
      expect(onDecline).not.toHaveBeenCalled();
    });
  });

  describe('when a decision already exists', () => {
    it.each(['approved', 'declined'] as const)('prevents changing a %s decision', status => {
      const onApprove = vi.fn();
      const onDecline = vi.fn();
      render(<ToolApprovalControls isRunning={false} status={status} onApprove={onApprove} onDecline={onDecline} />);
      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
      fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(onApprove).not.toHaveBeenCalled();
      expect(onDecline).not.toHaveBeenCalled();
    });
  });
});
