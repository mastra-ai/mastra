// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentsToolbar } from '../experiments-toolbar';
import type { ExperimentsToolbarProps } from '../experiments-toolbar';
import { agentTargetFields } from './fixtures/target-fields';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(cleanup);

const getChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');

// Plain `render`: no QueryClient or MastraReactProvider, so the toolbar can only show data it is given.
const renderToolbar = (overrides: Partial<ExperimentsToolbarProps> = {}) =>
  render(
    <TooltipProvider>
      <ExperimentsToolbar
        search=""
        statusFilter="all"
        datasetFilter="all"
        datasetOptions={[]}
        targetType=""
        targetId=""
        targetFields={agentTargetFields}
        onFiltersChange={vi.fn()}
        selection={{ selectedIds: [], onClearSelection: vi.fn(), onCompare: vi.fn() }}
        {...overrides}
      />
    </TooltipProvider>,
  );

describe('ExperimentsToolbar', () => {
  describe('when rendered without data providers', () => {
    it('renders an empty Experiments filter bar', () => {
      renderToolbar();

      expect(screen.getByRole('group', { name: 'Experiments filters' })).not.toBeNull();
      expect(getChips()).toHaveLength(0);
    });
  });

  describe('when a target is selected', () => {
    it('names the target from the fields it is given', () => {
      renderToolbar({ targetType: 'agent', targetId: 'agent-1' });

      expect(screen.getByRole('group', { name: 'Target type Agent' })).not.toBeNull();
      expect(screen.getByRole('group', { name: 'Agent Support Agent' })).not.toBeNull();
    });
  });
});
