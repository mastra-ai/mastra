// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatasetItems } from '../dataset-items';
import { TestLinkProvider } from '@/test/link-provider';

afterEach(() => cleanup());

const renderEmpty = (props: Partial<React.ComponentProps<typeof DatasetItems>> = {}) =>
  render(
    <TestLinkProvider>
      <MemoryRouter initialEntries={['/datasets/ds-1']}>
        <DatasetItems
          items={[]}
          isLoading={false}
          onItemClick={() => {}}
          onAddClick={() => {}}
          datasetName="My dataset"
          currentDatasetVersion={1}
          {...props}
        />
      </MemoryRouter>
    </TestLinkProvider>,
  );

describe('DatasetItems empty state', () => {
  it('renders the "No items yet" empty state with a docs link', () => {
    renderEmpty();

    expect(screen.getByText('No items yet')).not.toBeNull();

    const link = screen.getByRole('link', { name: /Datasets Documentation/ });
    expect(link.getAttribute('href')).toBe('https://mastra.ai/docs/evals/datasets');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('does not render the search field when the dataset has no items', () => {
    renderEmpty();

    expect(screen.queryByRole('searchbox', { name: 'Search items' })).toBeNull();
  });

  it('keeps the search field when a search matches no items', () => {
    renderEmpty({ searchQuery: 'nothing', onSearchChange: () => {} });

    expect(screen.getByRole('searchbox', { name: 'Search items' })).not.toBeNull();
  });

  it('offers the same ways to add items as the create dialog', () => {
    renderEmpty({ onImportClick: () => {}, onImportJsonClick: () => {} });

    expect(screen.getByRole('button', { name: 'Add items manually' })).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Import from a file' })).not.toBeNull();
  });

  it('adds an item manually', () => {
    const onAddClick = vi.fn();
    renderEmpty({ onAddClick });

    fireEvent.click(screen.getByRole('button', { name: 'Add items manually' }));

    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it('opens the CSV import by default', () => {
    const onImportClick = vi.fn();
    const onImportJsonClick = vi.fn();
    renderEmpty({ onImportClick, onImportJsonClick });

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(onImportClick).toHaveBeenCalledTimes(1);
    expect(onImportJsonClick).not.toHaveBeenCalled();
  });

  it('opens the JSON import when JSON is picked', () => {
    const onImportClick = vi.fn();
    const onImportJsonClick = vi.fn();
    renderEmpty({ onImportClick, onImportJsonClick });

    fireEvent.click(screen.getByRole('combobox', { name: 'File format' }));
    fireEvent.pointerDown(screen.getByRole('option', { name: 'JSON' }), { pointerType: 'mouse' });
    fireEvent.click(screen.getByRole('option', { name: 'JSON' }), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(onImportJsonClick).toHaveBeenCalledTimes(1);
    expect(onImportClick).not.toHaveBeenCalled();
  });

  it('opens the add item action when pressing C', () => {
    const onAddClick = vi.fn();
    renderEmpty({ onAddClick });

    fireEvent.keyDown(window, { key: 'c' });

    expect(onAddClick).toHaveBeenCalledTimes(1);
  });
});
