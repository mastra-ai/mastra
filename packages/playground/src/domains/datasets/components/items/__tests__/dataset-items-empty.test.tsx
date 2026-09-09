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

  it('wires the add and import actions', () => {
    const onAddClick = vi.fn();
    const onImportClick = vi.fn();
    const onImportJsonClick = vi.fn();
    renderEmpty({ onAddClick, onImportClick, onImportJsonClick });

    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }));

    expect(onAddClick).toHaveBeenCalledTimes(1);
    expect(onImportClick).toHaveBeenCalledTimes(1);
    expect(onImportJsonClick).toHaveBeenCalledTimes(1);
  });
});
