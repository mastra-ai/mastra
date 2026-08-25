// @vitest-environment jsdom
import type { DatasetItem } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatasetItems } from '../dataset-items';
import { TestLinkProvider } from '@/test/link-provider';

const now = new Date().toISOString();

const items = [
  { id: 'item-a', datasetId: 'ds-1', input: { q: 'alpha' }, version: 1, createdAt: now, updatedAt: now },
  { id: 'item-b', datasetId: 'ds-1', input: { q: 'beta' }, version: 1, createdAt: now, updatedAt: now },
] as unknown as DatasetItem[];

afterEach(() => cleanup());

const renderItems = (props: Partial<React.ComponentProps<typeof DatasetItems>> = {}, initialUrl = '/datasets/ds-1') =>
  render(
    <TestLinkProvider>
      <MemoryRouter initialEntries={[initialUrl]}>
        <DatasetItems
          datasetId="ds-1"
          items={items}
          isLoading={false}
          featuredItemId={null}
          onItemSelect={() => {}}
          onItemClose={() => {}}
          onAddClick={() => {}}
          datasetName="My dataset"
          currentDatasetVersion={2}
          {...props}
        />
      </MemoryRouter>
    </TestLinkProvider>,
  );

const selectionTrigger = () => screen.getByRole('button', { name: /1 selected/ });

describe('DatasetItems selection', () => {
  it('always shows checkboxes on the current version, with no "Select &" menu', () => {
    renderItems();

    expect(screen.getByLabelText('Select all items')).toBeDefined();
    expect(screen.getByLabelText('Select item item-a')).toBeDefined();
    expect(screen.queryByText(/Select &/)).toBeNull();
  });

  it('hides checkboxes when viewing an older version', () => {
    renderItems({}, '/datasets/ds-1?version=1');

    expect(screen.queryByLabelText('Select all items')).toBeNull();
    expect(screen.queryByLabelText('Select item item-a')).toBeNull();
  });

  it('collects all contextual actions in a single "{n} selected" menu', () => {
    renderItems({
      onBulkDeleteClick: () => {},
      onCreateDatasetClick: () => {},
      onAddToDatasetClick: () => {},
    });

    fireEvent.click(screen.getByLabelText('Select item item-a'));
    fireEvent.click(selectionTrigger());

    expect(screen.getByText('Export CSV')).toBeDefined();
    expect(screen.getByText('Export JSON')).toBeDefined();
    expect(screen.getByText('Create Dataset from Items')).toBeDefined();
    expect(screen.getByText('Copy Items to Dataset')).toBeDefined();
    expect(screen.getByText('Delete Items')).toBeDefined();
    // Dropdown-only selection UX — no inline action buttons or Cancel.
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('invokes the Create Dataset action with the checked items', () => {
    const onCreateDatasetClick = vi.fn();
    renderItems({ onCreateDatasetClick, onAddToDatasetClick: () => {} });

    fireEvent.click(screen.getByLabelText('Select item item-a'));
    fireEvent.click(selectionTrigger());

    fireEvent.click(screen.getByText('Create Dataset from Items'));
    expect(onCreateDatasetClick).toHaveBeenCalledWith([expect.objectContaining({ id: 'item-a' })]);
  });

  it('hides menu actions whose handlers are unavailable in the current context', () => {
    renderItems(); // no delete / create / copy handlers

    fireEvent.click(screen.getByLabelText('Select item item-a'));
    fireEvent.click(selectionTrigger());

    expect(screen.queryByText('Delete Items')).toBeNull();
    expect(screen.queryByText('Create Dataset from Items')).toBeNull();
    expect(screen.queryByText('Copy Items to Dataset')).toBeNull();
    expect(screen.getByText('Export CSV')).toBeDefined();
  });

  it('clears the selection when the item is unchecked', () => {
    renderItems();

    fireEvent.click(screen.getByLabelText('Select item item-a'));
    fireEvent.click(screen.getByLabelText('Select item item-a'));

    expect(screen.queryByRole('button', { name: /selected/ })).toBeNull();
  });

  it('forwards checked item ids to the bulk delete handler', () => {
    const onBulkDeleteClick = vi.fn();
    renderItems({ onBulkDeleteClick });

    fireEvent.click(screen.getByLabelText('Select item item-a'));
    fireEvent.click(screen.getByLabelText('Select item item-b'));
    fireEvent.click(screen.getByRole('button', { name: /2 selected/ }));
    fireEvent.click(screen.getByText('Delete Items'));

    expect(onBulkDeleteClick).toHaveBeenCalledWith(expect.arrayContaining(['item-a', 'item-b']));
  });
});
