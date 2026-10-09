import { Composer } from '@mastra/playground-ui/components/Composer';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AttachFilePopover } from '../attach-file-popover';
import { ComposerAttachments } from '../attachment';
import { ComposerAttachmentsProvider } from '../composer-attachments';

// The native picker is the only browser boundary; the real provider classifies the files.
const pickLocalFiles = (files: File[]) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add a local file' }));
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Native file picker input is missing');
  fireEvent.change(input, { target: { files } });
};

describe('AttachFilePopover', () => {
  describe('when a spreadsheet is selected', () => {
    it('attaches it and closes the popover', async () => {
      render(
        <ComposerAttachmentsProvider>
          <AttachFilePopover />
          <ComposerAttachments />
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      pickLocalFiles([new File(['binary'], 'leads.xlsx')]);

      expect(await screen.findByRole('button', { name: 'Remove leads.xlsx' })).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Add a local file' })).toBeNull());
    });
  });

  describe('when an invalid URL is submitted inside the chat composer', () => {
    it('keeps the message unsent and explains the URL problem', async () => {
      const sendMessage = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
      render(
        <ComposerAttachmentsProvider>
          <Composer onSubmit={sendMessage}>
            <AttachFilePopover />
          </Composer>
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      const url = screen.getByRole('textbox', { name: 'Public URL' });
      fireEvent.change(url, { target: { value: 'not a url' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(document.activeElement).toBe(url);
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });
});
