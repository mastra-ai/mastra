import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { AttachFilePopover } from '../attach-file-popover';
import { ComposerAttachmentsProvider } from '../composer-attachments';
import { server } from '@/test/msw-server';

// The native picker is the only browser boundary; the real provider validates the files.
describe('AttachFilePopover', () => {
  describe('when an unsupported binary file is selected', () => {
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
      fireEvent.change(input, { target: { files: [new File([new Uint8Array([0xff, 0xfe, 0xfd])], 'archive.zip')] } });
      expect((await screen.findByRole('alert')).textContent).toContain('archive.zip');
    });
  });

  describe('when a spreadsheet URL is submitted', () => {
    it('rejects it before it becomes an attachment', async () => {
      server.use(
        http.head(
          'https://example.com/report.xlsx',
          () =>
            new HttpResponse(null, {
              status: 200,
              headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            }),
        ),
      );
      render(
        <ComposerAttachmentsProvider>
          <AttachFilePopover />
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      fireEvent.change(screen.getByLabelText('Public URL'), { target: { value: 'https://example.com/report.xlsx' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
      expect((await screen.findByRole('alert')).textContent).toContain('https://example.com/report.xlsx');
    });
  });
});
