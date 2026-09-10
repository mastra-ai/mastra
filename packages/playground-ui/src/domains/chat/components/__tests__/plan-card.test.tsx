// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PendingPlanCard } from '../plan-card';

afterEach(cleanup);

describe('PendingPlanCard', () => {
  describe('when no action callbacks are provided', () => {
    it('preserves the plan without approval actions or application providers', () => {
      render(<PendingPlanCard path="plan.md" content={'# Migration\n\nPreserve existing behavior.'} />);
      expect(screen.getByText('Migration')).toBeTruthy();
      expect(screen.getByText('Preserve existing behavior.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Approve the plan and switch to build' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reject the plan' })).toBeNull();
    });
  });
  describe('when approval alone is provided', () => {
    it('delegates approval independently of rejection', () => {
      const onApprove = vi.fn();
      render(<PendingPlanCard path="plan.md" content="# Migration" onApprove={onApprove} />);
      fireEvent.click(screen.getByRole('button', { name: 'Approve the plan and switch to build' }));
      expect(onApprove).toHaveBeenCalledExactlyOnceWith();
      expect(screen.queryByRole('button', { name: 'Reject the plan' })).toBeNull();
    });
  });
  describe('when rejection alone is provided', () => {
    it('delegates rejection independently of approval', () => {
      const onReject = vi.fn();
      render(<PendingPlanCard path="plan.md" content="# Migration" onReject={onReject} />);
      fireEvent.click(screen.getByRole('button', { name: 'Reject the plan' }));
      expect(onReject).toHaveBeenCalledExactlyOnceWith();
      expect(screen.queryByRole('button', { name: 'Approve the plan and switch to build' })).toBeNull();
    });
  });
  describe('when a decision is pending', () => {
    it('prevents sending another decision', () => {
      const onApprove = vi.fn();
      render(<PendingPlanCard path="plan.md" isRunning onApprove={onApprove} />);
      fireEvent.click(screen.getByRole('button', { name: 'Approve the plan and switch to build' }));
      expect(onApprove).not.toHaveBeenCalled();
    });
  });
});
