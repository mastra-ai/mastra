import { Composer } from '@mastra/playground-ui/components/Composer';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw-server';

import { AttachFilePopover } from '../attach-file-popover';
import { ComposerAttachmentsProvider } from '../composer-attachments';

// The native picker is the only browser boundary; the real provider validates the files.
const pickLocalFiles = (files: File[]) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add a local file' }));
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Native file picker input is missing');
  fireEvent.change(input, { target: { files } });
};

describe('AttachFilePopover', () => {
  describe('when an unsupported spreadsheet is selected', () => {
    it('explains how to attach readable data instead', async () => {
      render(
        <ComposerAttachmentsProvider>
          <AttachFilePopover />
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      pickLocalFiles([new File(['binary'], 'leads.xlsx')]);
      expect((await screen.findByRole('alert')).textContent).toContain('leads.xlsx');
      expect(screen.getByRole('alert').textContent).toContain('CSV');
    });
  });

  describe('when a local file was rejected and a public URL is then added', () => {
    it('adds the URL without asking the user to edit it again', async () => {
      const headImage = vi.fn(() => new HttpResponse(null, { headers: { 'content-type': 'image/png' } }));
      server.use(http.head('https://example.com/cat.png', headImage));
      render(
        <ComposerAttachmentsProvider>
          <AttachFilePopover />
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      const url = screen.getByRole('textbox', { name: 'Public URL' });
      fireEvent.change(url, { target: { value: 'https://example.com/cat.png' } });
      pickLocalFiles([new File(['binary'], 'leads.xlsx')]);
      await screen.findByRole('alert');
      expect(url.getAttribute('aria-invalid')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => expect(headImage).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Public URL' })).toBeNull());
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
