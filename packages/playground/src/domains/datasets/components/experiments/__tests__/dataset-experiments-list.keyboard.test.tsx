import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DatasetExperimentsList } from '../dataset-experiments-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { renderWithProviders } from '@/test/render';

const makeExperiment = (id: string): DatasetExperiment => ({
  id,
  datasetId: 'ds-1',
  datasetVersion: 1,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'agent-1',
  provenance: null,
  runnerAttestation: null,
  experimentSetId: null,
  comparisonId: null,
  variantId: null,
  trialIndex: null,
  status: 'completed',
  totalItems: 3,
  succeededCount: 3,
  failedCount: 0,
  skippedCount: 0,
  startedAt: '2026-08-25T10:00:00.000Z',
  completedAt: '2026-08-25T10:01:00.000Z',
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:01:00.000Z',
});

const experiments = [makeExperiment('exp-1'), makeExperiment('exp-2'), makeExperiment('exp-3')];

const renderList = (props?: Partial<Parameters<typeof DatasetExperimentsList>[0]>) =>
  renderWithProviders(
    <DatasetExperimentsList
      experiments={experiments}
      isSelectionActive={false}
      selectedExperimentIds={[]}
      onRowClick={() => {}}
      onToggleSelection={() => {}}
      {...props}
    />,
  );

describe('DatasetExperimentsList keyboard navigation', () => {
  describe('when the list renders', () => {
    it('applies a roving tabindex across the experiment rows', () => {
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
      renderList({ isSelectionActive: true });
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectArrowNavigation(rows);
    });
  });

  describe('when activating a focused row', () => {
    it('clicking a row still triggers onRowClick', () => {
      const onRowClick = vi.fn();
      renderList({ onRowClick });

      const rows = interactiveRows();
      fireEvent.focus(rows[0] as HTMLElement);
      fireEvent.keyDown(rows[0] as HTMLElement, { key: 'ArrowDown' });
      fireEvent.click(rows[1] as HTMLElement);

      expect(onRowClick).toHaveBeenCalledWith('exp-2');
    });
  });
});
