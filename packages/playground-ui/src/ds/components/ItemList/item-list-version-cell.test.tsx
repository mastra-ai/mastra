// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { ItemListVersionCell } from './item-list-version-cell';

afterEach(() => {
  cleanup();
});

describe('ItemListVersionCell', () => {
  it('exposes version indicators as keyboard-focusable tooltip triggers', () => {
    render(
      <TooltipProvider>
        <ItemListVersionCell version={2} isLatest isDeleted />
      </TooltipProvider>,
    );

    const latestVersion = screen.getByRole('button', { name: 'Latest version' });
    const deletedVersion = screen.getByRole('button', { name: 'Deleted in this version' });

    expect(latestVersion.tabIndex).toBe(0);
    expect(deletedVersion.tabIndex).toBe(0);

    latestVersion.focus();
    expect(document.activeElement).toBe(latestVersion);

    deletedVersion.focus();
    expect(document.activeElement).toBe(deletedVersion);
  });
});
