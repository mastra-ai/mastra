import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { TranscriptEntries } from '../Transcript';
import { toolApproval } from './fixtures/tool-approval';

describe('transcript approvals', () => {
  describe('when a tool requires a decision', () => {
    it.each([
      ['Approve', true],
      ['Decline', false],
    ] as const)('dispatches %s with the tool and prompt IDs', async (label, approved) => {
      const onApprove = vi.fn();
      renderWithProviders(<TranscriptEntries entries={[toolApproval]} onApprove={onApprove} onRespond={vi.fn()} />);

      expect(screen.getByRole('group', { name: 'Tool approval for write_file' })).toHaveTextContent('src/agent.ts');
      expect(screen.getByRole('button', { name: 'Approve write_file' })).toHaveFocus();
      await userEvent.click(screen.getByRole('button', { name: `${label} write_file` }));

      expect(onApprove).toHaveBeenCalledExactlyOnceWith('call-1', approved, 'approval-1');
    });
  });

  describe('when an approval is being submitted', () => {
    it('blocks both actions and allows a retry when the consumer clears pending', async () => {
      const onApprove = vi.fn();
      const { rerender } = renderWithProviders(
        <TranscriptEntries entries={[toolApproval]} isSubmitting onApprove={onApprove} onRespond={vi.fn()} />,
      );

      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeDisabled();
        fireEvent.click(button);
      }
      expect(onApprove).not.toHaveBeenCalled();

      rerender(<TranscriptEntries entries={[toolApproval]} onApprove={onApprove} onRespond={vi.fn()} />);
      await userEvent.click(screen.getByRole('button', { name: 'Decline write_file' }));

      expect(onApprove).toHaveBeenCalledExactlyOnceWith('call-1', false, 'approval-1');
    });
  });

  describe('when the request is resolved', () => {
    it('removes the prompt when the transcript drops it', () => {
      const onApprove = vi.fn();
      const onRespond = vi.fn();
      const { rerender } = renderWithProviders(
        <TranscriptEntries entries={[toolApproval]} onApprove={onApprove} onRespond={onRespond} />,
      );

      rerender(<TranscriptEntries entries={[]} onApprove={onApprove} onRespond={onRespond} />);

      expect(screen.queryByRole('group', { name: 'Tool approval for write_file' })).not.toBeInTheDocument();
    });
  });
});
