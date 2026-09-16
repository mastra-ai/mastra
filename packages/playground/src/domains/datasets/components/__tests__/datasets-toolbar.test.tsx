// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatasetsToolbar, type DatasetsToolbarProps } from '../datasets-toolbar';
import {
  agents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
  );
});

const renderToolbar = (overrides: Partial<DatasetsToolbarProps> = {}) =>
  renderWithProviders(
    <TooltipProvider>
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
        targetType=""
        onTargetTypeChange={vi.fn()}
        targetId=""
        onTargetIdChange={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>,
  );

describe('DatasetsToolbar', () => {
  it('offers Target type, Experiments and Tags filters; the Target picker waits for a type', () => {
    renderToolbar();

    // Selected values render in the trigger; each filter shows its "all" option.
    expect(screen.getByText('All targets')).not.toBeNull();
    expect(screen.getByText('All datasets')).not.toBeNull();
    expect(screen.getByText('All tags')).not.toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });

  it('shows the entity picker for the selected target type', async () => {
    renderToolbar({ targetType: 'agent', targetId: 'agent-1' });

    expect(screen.getByText('Agent')).not.toBeNull();
    expect(await screen.findByText('Support Agent')).not.toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(4);
  });
});
