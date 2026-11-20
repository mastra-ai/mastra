// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExperimentsList } from '../experiments-list';
import { experiments } from './fixtures/experiments';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';

const renderList = (props?: Partial<Parameters<typeof ExperimentsList>[0]>) =>
  render(
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
