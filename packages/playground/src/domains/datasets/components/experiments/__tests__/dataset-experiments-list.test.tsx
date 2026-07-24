import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetExperimentsList } from '../dataset-experiments-list';
import { namedExperiment, unnamedExperiment } from './fixtures/experiments';

const noop = () => {};

function renderList(experiment = namedExperiment, onRowClick: (id: string) => void = noop) {
  return render(
    <DatasetExperimentsList
      experiments={[experiment]}
      isSelectionActive={false}
      selectedExperimentIds={[]}
      onRowClick={onRowClick}
      onToggleSelection={noop}
    />,
  );
}

describe('DatasetExperimentsList', () => {
  afterEach(cleanup);

  describe('when the experiment has a name', () => {
    it('uses the name as the primary label', () => {
      renderList(namedExperiment);

      expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
    });

    it('shows the shortened id beneath the name', () => {
      renderList(namedExperiment);

      // Full 36-char id is shortened to the first 8 for the secondary line.
      expect(screen.getByText('a1b2c3d4')).toBeDefined();
      expect(screen.queryByText(namedExperiment.id)).toBeNull();
    });

    it('routes by the full experiment id when the row is clicked', () => {
      const onRowClick = vi.fn();
      renderList(namedExperiment, onRowClick);

      fireEvent.click(screen.getByText('entity-extraction / model-a'));

      expect(onRowClick).toHaveBeenCalledWith(namedExperiment.id);
    });
  });

  describe('when the experiment has no name', () => {
    it('falls back to the shortened id as the label', () => {
      renderList(unnamedExperiment);

      expect(screen.getByText('c0ffee00')).toBeDefined();
      expect(screen.queryByText('entity-extraction / model-a')).toBeNull();
    });
  });
});
