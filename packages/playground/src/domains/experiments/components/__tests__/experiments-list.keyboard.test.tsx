import { fireEvent } from '@testing-library/react';
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
    expect(rows.every(row => row.tagName === 'A')).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });

  describe('when selection mode is active', () => {
    it('keeps keyboard navigation on the inner row buttons', () => {
      renderList({ selection: { selectedExperimentIds: [], onToggleSelection: () => {} } });
      const rows = interactiveRows();
      expect(rows.length).toBe(experiments.length);
      expect(rows.every(row => row.tagName === 'BUTTON')).toBe(true);
      expectArrowNavigation(rows);
    });

    it('clicking a row toggles its selection instead of navigating', () => {
      const onToggleSelection = vi.fn();
      renderList({ selection: { selectedExperimentIds: [], onToggleSelection } });

      const rows = interactiveRows();
      fireEvent.focus(rows[0] as HTMLElement);
      fireEvent.keyDown(rows[0] as HTMLElement, { key: 'ArrowDown' });
      fireEvent.click(rows[1] as HTMLElement);

      // Rows are sorted newest first; the second row is the second-newest fixture.
      expect(onToggleSelection).toHaveBeenCalledWith(experiments[2].id);
    });
  });
});
