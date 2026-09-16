import type { DatasetExperimentResult } from '@mastra/client-js';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExperimentResultsList } from '../experiment-results-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { renderWithProviders } from '@/test/render';

const makeResult = (id: string): DatasetExperimentResult => ({
  id,
  experimentId: 'exp-1',
  itemId: `item-${id}`,
  itemDatasetVersion: 1,
  input: 'input',
  output: 'output',
  groundTruth: null,
  error: null,
  startedAt: '2026-08-25T10:00:00.000Z',
  completedAt: '2026-08-25T10:00:01.000Z',
  retryCount: 0,
  traceId: null,
  status: null,
  tags: null,
  scores: [],
  createdAt: '2026-08-25T10:00:00.000Z',
});

const results = [makeResult('r-1'), makeResult('r-2'), makeResult('r-3')];

const columns = [{ name: 'id', label: 'Item', size: '1fr' }];

const renderList = (props?: Partial<Parameters<typeof ExperimentResultsList>[0]>) =>
  renderWithProviders(
    <ExperimentResultsList
      results={results}
      isLoading={false}
      featuredResultId={null}
      onResultClick={() => {}}
      columns={columns}
      {...props}
    />,
  );

describe('ExperimentResultsList keyboard navigation', () => {
  describe('when the list renders', () => {
    it('applies a roving tabindex across result rows', () => {
      renderList();
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectRovingTabindex(rows);
    });
  });

  describe('when navigating with the keyboard', () => {
    it('moves focus with Arrow/Home/End keys', () => {
      renderList();
      expectArrowNavigation(interactiveRows());
    });
  });

  describe('when selection mode is active', () => {
    it('keeps keyboard navigation on the inner row buttons', () => {
      renderList({ selectedIds: new Set<string>(), onToggleSelect: () => {} });
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectArrowNavigation(rows);
    });
  });

  describe('when activating a focused row', () => {
    it('clicking a row still triggers onResultClick', () => {
      const onResultClick = vi.fn();
      renderList({ onResultClick });

      const rows = interactiveRows();
      fireEvent.focus(rows[0] as HTMLElement);
      fireEvent.keyDown(rows[0] as HTMLElement, { key: 'End' });
      fireEvent.click(rows[2] as HTMLElement);

      expect(onResultClick).toHaveBeenCalledWith('r-3');
    });
  });
});
