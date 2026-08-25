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

  it('shows the contextual actions once an item is checked', () => {
    renderItems({
      onBulkDeleteClick: () => {},
      onCreateDatasetClick: () => {},
      onAddToDatasetClick: () => {},
    });

    fireEvent.click(screen.getByLabelText('Select item item-a'));

    expect(screen.getByText('selected')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
    expect(screen.getByText('Export CSV')).toBeDefined();
    expect(screen.getByText('Export JSON')).toBeDefined();
    expect(screen.getByLabelText('More selection actions')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('exposes Create/Copy dataset actions in the more-actions menu', () => {
    const onCreateDatasetClick = vi.fn();
    renderItems({ onCreateDatasetClick, onAddToDatasetClick: () => {} });

    fireEvent.click(screen.getByLabelText('Select item item-a'));
    fireEvent.click(screen.getByLabelText('More selection actions'));

    fireEvent.click(screen.getByText('Create Dataset from Items'));
    expect(onCreateDatasetClick).toHaveBeenCalledWith([expect.objectContaining({ id: 'item-a' })]);
    expect(screen.queryByText('Compare Items')).toBeNull();
  });

  it('hides actions whose handlers are unavailable in the current context', () => {
    renderItems(); // no delete / create / copy handlers

    fireEvent.click(screen.getByLabelText('Select item item-a'));

    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.queryByLabelText('More selection actions')).toBeNull();
    expect(screen.getByText('Export CSV')).toBeDefined();
  });

  it('clears the selection with Cancel', () => {
    renderItems();

    fireEvent.click(screen.getByLabelText('Select item item-a'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('selected')).toBeNull();
  });

  it('forwards checked item ids to the bulk delete handler', () => {
    const onBulkDeleteClick = vi.fn();
    renderItems({ onBulkDeleteClick });

    fireEvent.click(screen.getByLabelText('Select item item-a'));
    fireEvent.click(screen.getByLabelText('Select item item-b'));
    fireEvent.click(screen.getByText('Delete'));

    expect(onBulkDeleteClick).toHaveBeenCalledWith(expect.arrayContaining(['item-a', 'item-b']));
  });
});
