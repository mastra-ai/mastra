import { fireEvent, screen, within } from '@testing-library/react';
import type { FormEventHandler } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { ComposerImageAttachments } from '../ComposerImageAttachments';

describe('composer image attachments', () => {
  describe('when two images are attached', () => {
    it('previews an image and removes only the chosen image without submitting the message', () => {
      const onRemove = vi.fn();
      const onSubmit = vi.fn<FormEventHandler<HTMLFormElement>>(event => event.preventDefault());
      renderWithProviders(
        <form onSubmit={onSubmit}>
          <ComposerImageAttachments
            images={[
              { id: 'first', filename: 'first.png', mediaType: 'image/png', data: 'aGVsbG8=' },
              { id: 'second', filename: 'second.png', mediaType: 'image/png', data: 'd29ybGQ=' },
            ]}
            onRemove={onRemove}
          />
        </form>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Preview first.png' }));
      expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute(
        'src',
        'data:image/png;base64,aGVsbG8=',
      );
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove second.png' }));

      expect(onRemove).toHaveBeenCalledExactlyOnceWith('second');
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
