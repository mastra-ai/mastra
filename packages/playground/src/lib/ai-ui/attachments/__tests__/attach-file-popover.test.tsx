import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
});
