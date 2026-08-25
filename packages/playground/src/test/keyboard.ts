import { fireEvent } from '@testing-library/react';

/** All interactive DataList rows registered with the roving-tabindex keyboard hook. */
export const interactiveRows = (container: ParentNode = document) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-row-index]'));

/** Asserts exactly one row is tabbable (roving tabindex entry point). */
export const expectRovingTabindex = (rows: HTMLElement[]) => {
  if (rows.length === 0) throw new Error('No interactive rows found');
  const tabbable = rows.filter(row => row.tabIndex === 0);
  if (tabbable.length !== 1) {
    throw new Error(`Expected exactly one tabbable row, found ${tabbable.length}`);
  }
};

/** Drives ArrowDown/ArrowUp/Home/End across rows and asserts focus follows. */
export const expectArrowNavigation = (rows: HTMLElement[]) => {
  if (rows.length < 2) throw new Error('Need at least two rows for arrow navigation');
  const first = rows[0];
  const second = rows[1];
  const last = rows[rows.length - 1];
  if (!first || !second || !last) throw new Error('Missing rows');

  fireEvent.focus(first);
  fireEvent.keyDown(first, { key: 'ArrowDown' });
  if (document.activeElement !== second) throw new Error('ArrowDown did not move focus to the second row');

  fireEvent.keyDown(second, { key: 'ArrowUp' });
  if (document.activeElement !== first) throw new Error('ArrowUp did not move focus back to the first row');

  fireEvent.keyDown(first, { key: 'End' });
  if (document.activeElement !== last) throw new Error('End did not move focus to the last row');

  fireEvent.keyDown(last, { key: 'Home' });
  if (document.activeElement !== first) throw new Error('Home did not move focus to the first row');
};
