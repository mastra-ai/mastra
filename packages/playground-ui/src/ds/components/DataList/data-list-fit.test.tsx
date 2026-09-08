// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataList } from './data-list';

afterEach(() => {
  cleanup();
});

const gridOf = (container: HTMLElement) => {
  const grid = Array.from(container.querySelectorAll('div')).find(div =>
    div.style.gridTemplateColumns ? true : false,
  );
  if (!grid) throw new Error('DataList grid element not found');
  return grid;
};

describe('DataListRoot fit', () => {
  it('defaults to content sizing so wide tables scroll horizontally', () => {
    const { container } = render(
      <DataList columns="1fr 1fr">
        <DataList.RowStatic>
          <DataList.Cell>a</DataList.Cell>
          <DataList.Cell>b</DataList.Cell>
        </DataList.RowStatic>
      </DataList>,
    );

    const grid = gridOf(container);
    expect(grid.className).toContain('w-max');
    expect(grid.className).toContain('min-w-full');
  });

  it('container fit fills the available width instead of overflowing', () => {
    const { container } = render(
      <DataList columns="auto minmax(0, 1fr)" fit="container">
        <DataList.RowStatic>
          <DataList.Cell>a</DataList.Cell>
          <DataList.Cell>b</DataList.Cell>
        </DataList.RowStatic>
      </DataList>,
    );

    const grid = gridOf(container);
    expect(grid.className).toContain('w-full');
    expect(grid.className).toContain('max-w-full');
    expect(grid.className).not.toContain('w-max');
  });
});
