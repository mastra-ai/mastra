// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { ItemListVersionCell } from './item-list-version-cell';

afterEach(() => {
  cleanup();
});

describe('ItemListVersionCell', () => {
  describe('when the latest version is also deleted', () => {
    it('adds both indicators to the row name without nesting controls', () => {
      render(
        <TooltipProvider>
          <button type="button">
            <ItemListVersionCell version={2} isLatest isDeleted />
          </button>
        </TooltipProvider>,
      );

      const latestVersion = screen.getByRole('img', { name: 'Latest version' });
      const deletedVersion = screen.getByRole('img', { name: 'Deleted in this version' });
      const row = screen.getByRole('button', { name: /Latest version.*Deleted in this version/ });

      expect(screen.getAllByRole('button')).toEqual([row]);
      expect(latestVersion.tabIndex).toBe(-1);
      expect(deletedVersion.tabIndex).toBe(-1);
    });
  });
});
