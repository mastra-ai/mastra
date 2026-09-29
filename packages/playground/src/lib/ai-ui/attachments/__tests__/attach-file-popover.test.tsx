import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AttachFilePopover } from '../attach-file-popover';
import { ComposerAttachmentsProvider } from '../composer-attachments';

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
});
