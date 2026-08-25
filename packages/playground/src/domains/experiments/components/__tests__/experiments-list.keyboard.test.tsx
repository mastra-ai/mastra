import { describe, expect, it } from 'vitest';

import { ExperimentsList } from '../experiments-list';
import { experiments } from './fixtures/experiments';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentsList experiments={experiments} isLoading={false} />
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
});
