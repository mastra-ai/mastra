import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExperimentsList } from '../experiments-list';
import { experiments, noAgents, noProcessors, noScorers, noWorkflows } from './fixtures/experiments';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
  );
});

const renderList = (props?: Partial<Parameters<typeof ExperimentsList>[0]>) =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentsList experiments={experiments} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

describe('ExperimentsList keyboard navigation', () => {
  it('applies a roving tabindex to experiment rows', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows.length).toBe(experiments.length);
    // The RowWrapper is the focus target; the link inside is out of the tab order.
    expect(rows.every(row => row.tagName === 'DIV')).toBe(true);
    expect(rows.every(row => row.querySelector('a')?.tabIndex === -1)).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });

  describe('when rows are selectable', () => {
    const selection = (onToggleSelection = vi.fn()) => ({
      selectedExperimentIds: [],
      onToggleSelection,
      onToggleAll: vi.fn(),
    });

    it('keeps keyboard navigation and the experiment links on the row wrappers', () => {
      renderList({ selection: selection() });
      const rows = interactiveRows();
      expect(rows.length).toBe(experiments.length);
      expect(rows.every(row => row.tagName === 'DIV')).toBe(true);
      expect(rows.every(row => row.querySelector('a')?.tabIndex === -1)).toBe(true);
      expectArrowNavigation(rows);
    });

    it('toggles selection from the row checkbox only', () => {
      const onToggleSelection = vi.fn();
      renderList({ selection: selection(onToggleSelection) });

      const rows = interactiveRows();
      fireEvent.click(rows[1]);
      expect(onToggleSelection).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('checkbox', { name: `Select experiment ${experiments[2].id}` }));
      expect(onToggleSelection).toHaveBeenCalledWith(experiments[2].id);
    });
  });
});
