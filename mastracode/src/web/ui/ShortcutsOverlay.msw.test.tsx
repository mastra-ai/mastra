import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../e2e/web-ui/render';
import { ShortcutsOverlay } from './ShortcutsOverlay';

describe('ShortcutsOverlay', () => {
  describe('when it opens', () => {
    it('shows the shortcuts dialog with its rows', () => {
      renderWithProviders(<ShortcutsOverlay onClose={vi.fn()} />);

      expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
      expect(screen.getByText('Open the command palette')).toBeInTheDocument();
      expect(screen.getByText('Insert a newline')).toBeInTheDocument();
    });
  });

  describe('when the close button is clicked', () => {
    it('calls onClose', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<ShortcutsOverlay onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
