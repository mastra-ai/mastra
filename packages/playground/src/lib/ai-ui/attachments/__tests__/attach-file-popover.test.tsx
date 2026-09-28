import { Composer } from '@mastra/playground-ui/components/Composer';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AttachFilePopover } from '../attach-file-popover';
import { ComposerAttachmentsProvider } from '../composer-attachments';

// The native picker is the only browser boundary; the real provider validates the files.
describe('AttachFilePopover', () => {
  describe('when an unsupported spreadsheet is selected', () => {
    it('explains how to attach readable data instead', async () => {
      render(
        <ComposerAttachmentsProvider>
          <AttachFilePopover />
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add a local file' }));
      const input = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error('Native file picker input is missing');
      fireEvent.change(input, { target: { files: [new File(['binary'], 'leads.xlsx')] } });
      expect((await screen.findByRole('alert')).textContent).toContain('leads.xlsx');
      expect(screen.getByRole('alert').textContent).toContain('CSV');
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
