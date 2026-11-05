import { AttachFilePopover } from '@mastra/playground-ui/domains/agent-chat/thread/attachments/attach-file-popover';
import { ComposerAttachments } from '@mastra/playground-ui/domains/agent-chat/thread/attachments/attachment';

import { ComposerAttachmentsProvider } from '@mastra/playground-ui/domains/agent-chat/thread/attachments/composer-attachments';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
      const preview = await screen.findByRole('button', { name: 'Preview leads.csv' });
      fireEvent.click(screen.getByRole('button', { name: 'Actions for leads.csv' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Preview' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain('name,score\nZoë,12');

      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(document.activeElement).toBe(preview));
      fireEvent.click(preview);
      expect(screen.getByRole('dialog').textContent).toContain('name,score\nZoë,12');
    });
  });
});
