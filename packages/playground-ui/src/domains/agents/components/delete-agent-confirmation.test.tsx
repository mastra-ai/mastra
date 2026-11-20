// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteAgentConfirmation } from './delete-agent-confirmation';

const renderConfirmation = (props: { isPending?: boolean; isDependentsLoading?: boolean } = {}) => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <DeleteAgentConfirmation
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      description="Deleting this agent cannot be undone."
      isPending={props.isPending ?? false}
      isDependentsLoading={props.isDependentsLoading ?? false}
    >
      <p>Dependent agent warning</p>
    </DeleteAgentConfirmation>,
  );
  return { onConfirm, onOpenChange };
};

describe('DeleteAgentConfirmation', () => {
  afterEach(cleanup);

  describe('when the dialog is ready', () => {
    it('renders host-provided copy and warnings', () => {
      renderConfirmation();
      expect(screen.getByText('Deleting this agent cannot be undone.')).toBeTruthy();
      expect(screen.getByText('Dependent agent warning')).toBeTruthy();
    });

    it('calls the host confirmation callback without closing itself', () => {
      const { onConfirm, onOpenChange } = renderConfirmation();
      fireEvent.click(screen.getByTestId('agent-builder-delete-agent-confirm'));
      expect(onConfirm).toHaveBeenCalledOnce();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('delegates cancellation to the host', () => {
      const { onConfirm, onOpenChange } = renderConfirmation();
      fireEvent.click(screen.getByTestId('agent-builder-delete-agent-cancel'));
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when dependents are loading', () => {
    it('disables confirmation', () => {
      const { onConfirm } = renderConfirmation({ isDependentsLoading: true });
      fireEvent.click(screen.getByTestId('agent-builder-delete-agent-confirm'));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when deletion is pending', () => {
    it('disables cancellation and confirmation', () => {
      const { onConfirm, onOpenChange } = renderConfirmation({ isPending: true });
      fireEvent.click(screen.getByTestId('agent-builder-delete-agent-confirm'));
      fireEvent.click(screen.getByTestId('agent-builder-delete-agent-cancel'));
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByText('Deleting…')).toBeTruthy();
    });
  });
});
