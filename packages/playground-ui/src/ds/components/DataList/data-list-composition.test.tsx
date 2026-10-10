// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataList } from './data-list';

afterEach(() => {
  cleanup();
});

const Rows = () => (
  <>
    <DataList.Top>
      <DataList.TopCell>Type</DataList.TopCell>
      <DataList.TopCell>Balance</DataList.TopCell>
    </DataList.Top>
    <DataList.RowStatic>
      <DataList.TextCell>Credit grant</DataList.TextCell>
      <DataList.NumberCell>$6.95</DataList.NumberCell>
    </DataList.RowStatic>
  </>
);

const withoutGeneratedIds = (html: string) => html.replace(/_r_[0-9a-z]+_/g, '');

describe('DataList composition', () => {
  it('renders the same DOM when the new props are unset', () => {
    const plain = render(
      <DataList columns="1fr auto">
        <Rows />
      </DataList>,
    ).container.innerHTML;
    cleanup();
    const explicit = render(
      <DataList columns="1fr auto" size={undefined} toolbar={undefined}>
        <Rows />
      </DataList>,
    ).container.innerHTML;

    expect(withoutGeneratedIds(explicit)).toBe(withoutGeneratedIds(plain));
  });

  it('renders the toolbar inside the frame, above and outside the scrolling grid', () => {
    const { container } = render(
      <DataList
        columns="1fr auto"
        toolbar={
          <DataList.Toolbar>
            <DataList.ToolbarStart>
              <input aria-label="Search credits" />
            </DataList.ToolbarStart>
            <DataList.ToolbarEnd>
              <button type="button">Status</button>
            </DataList.ToolbarEnd>
          </DataList.Toolbar>
        }
      >
        <Rows />
      </DataList>,
    );

    const search = screen.getByRole('textbox', { name: 'Search credits' });
    const toolbar = search.closest('[data-slot="data-list-toolbar"]');
    const grid = container.querySelector('[style*="grid-template-columns"]');

    expect(toolbar?.parentElement).toBe(container.firstElementChild);
    expect(grid?.contains(search)).toBe(false);
    expect(toolbar?.nextElementSibling?.contains(grid ?? null)).toBe(true);
    expect(toolbar?.contains(screen.getByRole('button', { name: 'Status' }))).toBe(true);
  });

  it('stacks a description under the cell title only when one is given', () => {
    render(
      <DataList columns="1fr 1fr">
        <DataList.RowStatic>
          <DataList.StackedCell description="Onboarding reward">Deployed starter agent</DataList.StackedCell>
          <DataList.StackedCell>Verified work email</DataList.StackedCell>
        </DataList.RowStatic>
      </DataList>,
    );

    expect(screen.getByText('Onboarding reward').previousElementSibling?.textContent).toBe('Deployed starter agent');
    expect(screen.getByText('Verified work email').parentElement?.childElementCount).toBe(1);
  });
});
