// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttachFileMenu } from '../attach-file-menu';

import { ComposerAttachments } from '../attachment';
import { ComposerAttachmentsProvider } from '../composer-attachments';
import { Composer } from '@/ds/components/Composer';

// The native picker is the only browser boundary; the real provider classifies the files.
const pickLocalFiles = async (files: File[]) => {
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Files' }));
  fireEvent.change(screen.getByLabelText('Files'), { target: { files } });
};

describe('AttachFileMenu', () => {
  describe('when a spreadsheet is picked from Files', () => {
    it('attaches it and closes the menu', async () => {
      render(
        <ComposerAttachmentsProvider>
          <AttachFileMenu />
          <ComposerAttachments />
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      await pickLocalFiles([new File(['binary'], 'leads.xlsx')]);

      expect(await screen.findByRole('button', { name: 'Remove leads.xlsx' })).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Files' })).toBeNull());
    });
  });

  describe('when an invalid URL is submitted inside the chat composer', () => {
    it('keeps the message unsent and explains the URL problem', async () => {
      const sendMessage = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
      render(
        <ComposerAttachmentsProvider>
          <Composer onSubmit={sendMessage}>
            <AttachFileMenu />
          </Composer>
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'From a URL…' }));
      const url = await screen.findByRole('textbox', { name: 'Public URL' });
      fireEvent.change(url, { target: { value: 'not a url' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(document.activeElement).toBe(url);
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });
});
