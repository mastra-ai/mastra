// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatasetsToolbar } from '../datasets-toolbar';
import type { DatasetsToolbarProps } from '../datasets-toolbar';
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

const getChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');

const renderToolbar = (overrides: Partial<DatasetsToolbarProps> = {}) =>
  renderWithProviders(
    <TooltipProvider>
      <DatasetsToolbar
        search=""
        experimentFilter="all"
        tagFilter="all"
        tagOptions={[
          { value: 'all', label: 'All tags' },
          { value: 'prod', label: 'prod' },
        ]}
        targetType=""
        targetId=""
        onFiltersChange={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>,
  );

describe('DatasetsToolbar', () => {
  describe('when no filter is set', () => {
    it('renders an empty Datasets filter bar', () => {
      renderToolbar();

      expect(screen.getByRole('group', { name: 'Datasets filters' })).not.toBeNull();
      expect(getChips()).toHaveLength(0);
    });
  });

  describe('when a target is selected', () => {
    it('shows the target type and the target name as chips', async () => {
      renderToolbar({ targetType: 'agent', targetId: 'agent-1' });

      expect(screen.getByRole('group', { name: 'Target type Agent' })).not.toBeNull();
      expect(await screen.findByRole('group', { name: 'Agent Support Agent' })).not.toBeNull();
    });
  });
});
