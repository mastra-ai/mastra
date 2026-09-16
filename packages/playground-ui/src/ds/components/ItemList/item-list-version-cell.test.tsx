// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { getItemListVersionStatusLabel } from './helpers';
import { ItemListRowButton } from './item-list-row-button';
import { ItemListVersionCell } from './item-list-version-cell';

afterEach(() => {
  cleanup();
});

describe('ItemListVersionCell', () => {
  describe('when the latest version is also deleted', () => {
    it('opens both indicator tooltips from the keyboard without nesting buttons', async () => {
      const tooltip = getItemListVersionStatusLabel({ isLatest: true, isDeleted: true });

      render(
        <TooltipProvider delay={0} timeout={0}>
          <ItemListRowButton tooltip={tooltip}>
            <ItemListVersionCell version={2} isLatest isDeleted />
          </ItemListRowButton>
        </TooltipProvider>,
      );

      const latestVersion = screen.getByRole('img', { name: 'Latest version' });
      const deletedVersion = screen.getByRole('img', { name: 'Deleted in this version' });
      const row = screen.getByRole('button', { name: /Latest version.*Deleted in this version/ });

      expect(screen.getAllByRole('button')).toEqual([row]);
      expect(latestVersion.tabIndex).toBe(-1);
      expect(deletedVersion.tabIndex).toBe(-1);

      row.focus();
      expect(document.activeElement).toBe(row);
      expect((await screen.findByRole('tooltip')).textContent).toBe(tooltip);
    });
  });
});
