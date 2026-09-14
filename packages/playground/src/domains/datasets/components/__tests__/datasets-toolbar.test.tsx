// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DatasetsToolbar } from '../datasets-toolbar';

afterEach(() => cleanup());

const renderToolbar = () =>
  render(
    <DatasetsToolbar
      search=""
      onSearchChange={vi.fn()}
      experimentFilter="all"
      onExperimentFilterChange={vi.fn()}
      tagFilter="all"
      onTagFilterChange={vi.fn()}
      tagOptions={[
        { value: 'all', label: 'All tags' },
        { value: 'prod', label: 'prod' },
      ]}
    />,
  );

describe('DatasetsToolbar', () => {
  it('offers Experiments and Tags filters but no Target filter', () => {
    renderToolbar();

    // Selected values render in the trigger; each filter shows its "all" option.
    expect(screen.getByText('All datasets')).not.toBeNull();
    expect(screen.getByText('All tags')).not.toBeNull();
    expect(screen.queryByText('All targets')).toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });
});
