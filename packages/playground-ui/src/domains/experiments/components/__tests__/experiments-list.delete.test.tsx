// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExperimentsList } from '../experiments-list';
import { experiments } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';

const renderList = (onDeleteExperiment?: (experimentId: string) => Promise<void>) =>
  render(
    <TestLinkProvider>
      <ExperimentsList experiments={experiments} isLoading={false} onDeleteExperiment={onDeleteExperiment} />
    </TestLinkProvider>,
  );

describe('ExperimentsList delete action', () => {
  describe('when the call site handles deletion', () => {
    it('renders a delete button for every row', () => {
      renderList(vi.fn(() => Promise.resolve()));

      expect(screen.getByRole('button', { name: 'Delete experiment entity-extraction / model-a' })).toBeDefined();
      // Unnamed experiment falls back to its id in the accessible label.
      expect(
        screen.getByRole('button', { name: 'Delete experiment c0ffee00-0000-0000-0000-000000000003' }),
      ).toBeDefined();
    });

    it('deletes the experiment once the dialog is confirmed', async () => {
      const onDeleteExperiment = vi.fn((_experimentId: string) => Promise.resolve());
      renderList(onDeleteExperiment);

      fireEvent.click(screen.getByRole('button', { name: 'Delete experiment entity-extraction / model-a' }));
      expect(await screen.findByText(/Are you sure you want to delete .entity-extraction \/ model-a./)).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(onDeleteExperiment).toHaveBeenCalledWith('a1b2c3d4-0000-0000-0000-000000000001'));
    });

    it('closes the dialog after a successful delete', async () => {
      renderList(vi.fn(() => Promise.resolve()));

      fireEvent.click(screen.getByRole('button', { name: 'Delete experiment entity-extraction / model-a' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByText('Delete Experiment')).toBeNull());
    });

    it('does not delete when the dialog is cancelled', async () => {
      const onDeleteExperiment = vi.fn(() => Promise.resolve());
      renderList(onDeleteExperiment);

      fireEvent.click(screen.getByRole('button', { name: 'Delete experiment entity-extraction / model-a' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByText('Delete Experiment')).toBeNull());
      expect(onDeleteExperiment).not.toHaveBeenCalled();
    });
  });

  describe('when the delete fails', () => {
    it('keeps the dialog open so the user can retry', async () => {
      const onDeleteExperiment = vi.fn(() => Promise.reject(new Error('boom')));
      renderList(onDeleteExperiment);

      fireEvent.click(screen.getByRole('button', { name: 'Delete experiment entity-extraction / model-a' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

      // Busy while pending; no longer busy means the rejection was handled.
      await waitFor(() => expect(onDeleteExperiment).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Delete', busy: false })).toBeDefined());
      expect(screen.getByText('Delete Experiment')).toBeDefined();
    });
  });

  describe('when the call site does not handle deletion', () => {
    it('renders no delete buttons', () => {
      renderList();

      expect(screen.queryByRole('button', { name: /^Delete experiment/ })).toBeNull();
    });
  });
});
