import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DatasetsList } from '../datasets-list';
import type { DatasetsListProps } from '../datasets-list';
import { datasets, experiments, mixedExperiments } from './fixtures/datasets';
import { expectComputedTag } from '@/test/computed-tag';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const renderList = (props: Partial<DatasetsListProps> = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <DatasetsList datasets={datasets} experiments={experiments} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

describe('DatasetsList', () => {
  describe('when datasets have explicit or experiment-derived target types', () => {
    it('does not render the Target column or target labels', () => {
      renderList();
      expect(screen.getByRole('link', { name: /Dataset A/ })).toBeTruthy();
      expect(screen.getByRole('link', { name: /Dataset B/ })).toBeTruthy();
      expect(screen.queryByText('Target')).toBeNull();
      expect(screen.queryByText('agent')).toBeNull();
      expect(screen.queryByText('workflow')).toBeNull();
    });

    it('does not render a Review column', () => {
      renderList();
      expect(screen.queryByText('Review')).toBeNull();
    });

    it('links the experiments action to the global experiments page filtered by dataset', () => {
      renderList();
      const link = screen.getByRole('link', { name: /2 \(100%\)/ });
      expect(link.getAttribute('href')).toBe('/experiments?dataset=ds-a');
    });

    it('does not render an experiments action for datasets without experiments', () => {
      renderList();
      expect(screen.queryByRole('link', { name: /0 \(/ })).toBeNull();
    });

    it('keeps the remaining dataset details on the dataset link', () => {
      renderList();
      const row = screen.getByRole('link', { name: /Dataset A/ });
      expect(row.getAttribute('href')).toBe('/datasets/ds-a');
      expect(within(row).getByText('Customer support examples')).toBeTruthy();
      expect(within(row).getByText('v3')).toBeTruthy();
    });

    it('shows the first two tags with an overflow count', () => {
      renderList();
      const row = screen.getByRole('link', { name: /Dataset A/ });
      expect(within(row).getByText('support')).toBeTruthy();
      expect(within(row).getByText('english')).toBeTruthy();
      expect(within(row).queryByText('reviewed')).toBeNull();
      expect(within(row).getByText('+1')).toBeTruthy();
      expect(within(row).getByTitle('support, english, reviewed')).toBeTruthy();
    });

    it('renders each visible tag with colors computed from its value', () => {
      renderList();
      const row = screen.getByRole('link', { name: /Dataset A/ });
      expectComputedTag(within(row).getByText('support'), 'support');
      expectComputedTag(within(row).getByText('english'), 'english');
    });
  });

  describe('when a dataset has completed and failed experiments', () => {
    it('counts only its own experiments and rounds the completion percentage', () => {
      renderList({ experiments: mixedExperiments });
      expect(screen.getByRole('link', { name: '3 (67%)' }).getAttribute('href')).toBe('/experiments?dataset=ds-a');
    });
  });

  describe('when searching for a dataset with different capitalization', () => {
    it('shows only matching dataset names', () => {
      renderList({ search: 'DATASET b' });
      expect(screen.getByRole('link', { name: /Dataset B/ })).toBeTruthy();
      expect(screen.queryByRole('link', { name: /Dataset A/ })).toBeNull();
    });
  });

  describe('when filtering for datasets with experiments', () => {
    it('excludes datasets without experiments', () => {
      renderList({ experimentFilter: 'with' });
      expect(screen.getByRole('link', { name: /Dataset A/ })).toBeTruthy();
      expect(screen.queryByRole('link', { name: /Dataset B/ })).toBeNull();
    });
  });

  describe('when filtering for datasets without experiments', () => {
    it('excludes datasets with experiments', () => {
      renderList({ experimentFilter: 'without' });
      expect(screen.getByRole('link', { name: /Dataset B/ })).toBeTruthy();
      expect(screen.queryByRole('link', { name: /Dataset A/ })).toBeNull();
    });
  });

  describe('when filtering by a dataset tag', () => {
    it('excludes datasets without the selected tag', () => {
      renderList({ tagFilter: 'english' });
      expect(screen.getByRole('link', { name: /Dataset A/ })).toBeTruthy();
      expect(screen.queryByRole('link', { name: /Dataset B/ })).toBeNull();
    });
  });

  describe('when no dataset has the selected tag', () => {
    it('does not show dataset links', () => {
      renderList({ tagFilter: 'missing' });
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });
  });

  describe('when an onSelectDataset handler is provided', () => {
    it('renders rows as buttons instead of links and reports the clicked dataset', () => {
      const onSelectDataset = vi.fn();
      renderList({ onSelectDataset });
      expect(screen.queryAllByRole('link')).toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: /Dataset A/ }));
      expect(onSelectDataset).toHaveBeenCalledWith(expect.objectContaining({ id: 'ds-a' }));
    });

    it('keeps the experiments badge as plain text inside the row', () => {
      renderList({ onSelectDataset: vi.fn() });
      const row = screen.getByRole('button', { name: /Dataset A/ });
      expect(within(row).getByText('2 (100%)')).toBeTruthy();
    });

    it('marks the selected dataset row as featured', () => {
      renderList({ onSelectDataset: vi.fn(), selectedDatasetId: 'ds-a' });
      expect(screen.getByRole('button', { name: /Dataset A/ }).dataset.featured).toBe('true');
      expect(screen.getByRole('button', { name: /Dataset B/ }).dataset.featured).toBeUndefined();
    });

    it('lets the caller override the trailing cell per dataset', () => {
      renderList({
        onSelectDataset: vi.fn(),
        renderTrailingCell: ds => (ds.id === 'ds-a' ? <span>Generating...</span> : null),
      });
      expect(within(screen.getByRole('button', { name: /Dataset A/ })).getByText('Generating...')).toBeTruthy();
      expect(within(screen.getByRole('button', { name: /Dataset A/ })).queryByText('2 (100%)')).toBeNull();
    });
  });
});
