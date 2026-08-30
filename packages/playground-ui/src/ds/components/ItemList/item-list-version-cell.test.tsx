// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { ItemListVersionCell } from './item-list-version-cell';

afterEach(() => {
  cleanup();
});

describe('ItemListVersionCell', () => {
  describe('when the latest version is also deleted', () => {
    it('opens both indicator tooltips from the keyboard without nesting buttons', async () => {
      render(
        <TooltipProvider delay={0} timeout={0}>
          <button type="button">
            <ItemListVersionCell version={2} isLatest isDeleted />
          </button>
        </TooltipProvider>,
      );

      const latestVersion = screen.getByRole('img', { name: 'Latest version' });
      const deletedVersion = screen.getByRole('img', { name: 'Deleted in this version' });
      const row = screen.getByRole('button', { name: /Latest version.*Deleted in this version/ });

      expect(screen.getAllByRole('button')).toEqual([row]);

      latestVersion.focus();
      expect(document.activeElement).toBe(latestVersion);
      expect((await screen.findByRole('tooltip')).textContent).toBe('Latest version');

      latestVersion.blur();
      await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

      deletedVersion.focus();
      expect(document.activeElement).toBe(deletedVersion);
      expect((await screen.findByRole('tooltip')).textContent).toBe('Deleted in this version');
    });
  });
});
