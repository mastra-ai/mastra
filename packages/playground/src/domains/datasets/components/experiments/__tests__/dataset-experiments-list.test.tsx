import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetExperimentsList } from '../dataset-experiments-list';
import { namedExperiment, unnamedExperiment } from './fixtures/experiments';

const noop = () => {};

describe('DatasetExperimentsList', () => {
  afterEach(cleanup);

  it('shows the experiment name as the primary label with the short id beneath it', () => {
    render(
      <DatasetExperimentsList
        experiments={[namedExperiment]}
        isSelectionActive={false}
        selectedExperimentIds={[]}
        onRowClick={noop}
        onToggleSelection={noop}
      />,
    );

    expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
    // Full id (36 chars) is shortened to the first 8 for the secondary line.
    expect(screen.getByText('a1b2c3d4')).toBeDefined();
    expect(screen.queryByText(namedExperiment.id)).toBeNull();
  });

  it('falls back to the short id when the experiment has no name', () => {
    render(
      <DatasetExperimentsList
        experiments={[unnamedExperiment]}
        isSelectionActive={false}
        selectedExperimentIds={[]}
        onRowClick={noop}
        onToggleSelection={noop}
      />,
    );

    expect(screen.getByText('c0ffee00')).toBeDefined();
    expect(screen.queryByText('entity-extraction / model-a')).toBeNull();
  });

  it('routes by the full experiment id even though it displays the name', () => {
    const onRowClick = vi.fn();
    render(
      <DatasetExperimentsList
        experiments={[namedExperiment]}
        isSelectionActive={false}
        selectedExperimentIds={[]}
        onRowClick={onRowClick}
        onToggleSelection={noop}
      />,
    );

    fireEvent.click(screen.getByText('entity-extraction / model-a'));

    expect(onRowClick).toHaveBeenCalledWith(namedExperiment.id);
  });
});
