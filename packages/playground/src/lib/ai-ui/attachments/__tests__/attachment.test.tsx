import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AttachFilePopover } from '../attach-file-popover';
import { ComposerAttachments } from '../attachment';
import { ComposerAttachmentsProvider } from '../composer-attachments';

describe('composer attachment previews', () => {
  describe('when several text files are attached', () => {
    it('removes the named file while preserving the other preview and its content', async () => {
      render(
        <ComposerAttachmentsProvider>
          <AttachFilePopover />
          <ComposerAttachments />
        </ComposerAttachmentsProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add a local file' }));
      const picker = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (!picker) throw new Error('File picker is missing');
      const csv = 'name,score\nZoë,12';
      const leads = new File([csv], 'leads.csv', { type: 'text/csv' });
      const discarded = new File(['discard'], 'discard.txt', { type: 'text/plain' });
      Object.defineProperty(leads, 'text', { value: async () => csv });
      Object.defineProperty(discarded, 'text', { value: async () => 'discard' });
      fireEvent.change(picker, {
        target: { files: [leads, discarded] },
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Remove discard.txt' }));
      expect(screen.queryByRole('button', { name: 'Preview discard.txt' })).toBeNull();
      fireEvent.click(await screen.findByRole('button', { name: 'Preview leads.csv' }));
      expect(screen.getByRole('dialog').textContent).toContain('name,score\nZoë,12');
    });
  });
});
