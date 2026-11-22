// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RenameExperimentDialog } from '../rename-experiment-dialog';
import type { RenameExperimentPatch } from '../rename-experiment-dialog';
import { completedExperiment } from './fixtures/experiments';

const experiment = { ...completedExperiment, name: 'Baseline run', description: 'First pass' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderDialog = (onRename: (patch: RenameExperimentPatch) => Promise<void>, onOpenChange = vi.fn()) => {
  render(<RenameExperimentDialog experiment={experiment} open onOpenChange={onOpenChange} onRename={onRename} />);
  return onOpenChange;
};

const nameInput = () => screen.getByLabelText<HTMLInputElement>(/^Name/);
const descriptionInput = () => screen.getByLabelText<HTMLInputElement>('Description');
const saveButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Save' });

describe('RenameExperimentDialog', () => {
  it('opens prefilled with the current name and description', () => {
    renderDialog(async () => {});

    expect(nameInput().value).toBe('Baseline run');
    expect(descriptionInput().value).toBe('First pass');
  });

  describe('when the name is blank', () => {
    it('disables Save', () => {
      renderDialog(async () => {});

      fireEvent.change(nameInput(), { target: { value: '   ' } });

      expect(saveButton().disabled).toBe(true);
    });
  });

  describe('when the rename succeeds', () => {
    it('sends the trimmed name and description, then closes', async () => {
      const onRename = vi.fn(async (_patch: RenameExperimentPatch) => {});
      const onOpenChange = renderDialog(onRename);

      fireEvent.change(nameInput(), { target: { value: '  Renamed run  ' } });
      fireEvent.change(descriptionInput(), { target: { value: '' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(onRename).toHaveBeenCalledExactlyOnceWith({ name: 'Renamed run', description: '' });
    });
  });

  describe('when the rename fails', () => {
    it('shows an error toast and stays open', async () => {
      const toastError = vi.spyOn(toast, 'error');
      const onOpenChange = renderDialog(async () => {
        throw new Error('boom');
      });

      fireEvent.click(saveButton());

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          expect.stringMatching(/failed to rename experiment: boom/i),
          expect.anything(),
        ),
      );
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
