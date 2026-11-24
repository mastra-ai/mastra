// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentsComparison } from '../experiments-comparison';
import {
  BASELINE_ID,
  CONTENDER_ID,
  baselineResults,
  comparisonResponse,
  contenderResults,
} from './fixtures/comparison';
import { comparedExperimentsById } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';

type ComparisonProps = ComponentProps<typeof ExperimentsComparison>;

const renderComparison = (props: Partial<ComparisonProps> = {}) =>
  render(
    <TestLinkProvider>
      <ExperimentsComparison
        experimentIds={[BASELINE_ID, CONTENDER_ID]}
        comparison={comparisonResponse}
        experimentsById={comparedExperimentsById}
        resultsById={{ [BASELINE_ID]: baselineResults, [CONTENDER_ID]: contenderResults }}
        isLoading={false}
        isResultsLoading={false}
        supportsMetrics={false}
        {...props}
      />
    </TestLinkProvider>,
  );

const itemRow = (itemId: string) => screen.getByRole('row', { name: itemId });

afterEach(() => {
  cleanup();
});

describe('ExperimentsComparison', () => {
  describe('when the comparison loads', () => {
    it('renders a row per compared item', () => {
      renderComparison();

      expect(itemRow('item-a')).toBeTruthy();
      expect(itemRow('item-b')).toBeTruthy();
      expect(itemRow('item-c')).toBeTruthy();
    });
  });

  describe('when the host renders an item panel', () => {
    it('opens the clicked row in the item panel', () => {
      const itemPanel = vi.fn<NonNullable<ComparisonProps['itemPanel']>>(({ itemId }) => (
        <aside aria-label="Item panel">{itemId}</aside>
      ));
      renderComparison({ itemPanel });

      fireEvent.click(itemRow('item-b'));

      expect(screen.getByRole('complementary', { name: 'Item panel' }).textContent).toBe('item-b');
    });
  });

  describe('when the host renders no item panel', () => {
    it('keeps the rows out of the tab order', () => {
      renderComparison();

      expect(itemRow('item-a').getAttribute('tabindex')).toBeNull();
    });
  });

  describe('when the host renders a trace panel', () => {
    it('opens the cell trace in the trace panel', () => {
      renderComparison({
        tracePanel: ({ traceId }) => <aside aria-label="Trace panel">{traceId}</aside>,
      });

      const baselineCell = within(itemRow('item-a')).getByRole('cell', { name: 'Baseline' });
      fireEvent.click(within(baselineCell).getByRole('button', { name: 'View trace' }));

      expect(screen.getByRole('complementary', { name: 'Trace panel' }).textContent).toBe('trace-res-baseline-a');
    });
  });

  describe('when the host renders no trace panel', () => {
    it('offers no trace link', () => {
      renderComparison();

      expect(screen.queryByRole('button', { name: 'View trace' })).toBeNull();
    });
  });

  describe('when the host can rename experiments', () => {
    it('renames the experiment of the column', async () => {
      const onRenameExperiment = vi.fn<NonNullable<ComparisonProps['onRenameExperiment']>>(async () => {});
      renderComparison({ onRenameExperiment });

      const contenderHeader = screen.getByRole('columnheader', { name: 'Contender 1' });
      fireEvent.click(within(contenderHeader).getByRole('button', { name: 'Contender run' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename experiment' }));
      fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Renamed contender' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await vi.waitFor(() =>
        expect(onRenameExperiment).toHaveBeenCalledWith(comparedExperimentsById[CONTENDER_ID], {
          name: 'Renamed contender',
          description: 'Entity extraction evaluation using Model A',
        }),
      );
    });
  });

  describe('when the comparison fails to load', () => {
    it('explains the error', () => {
      renderComparison({ comparison: undefined, error: new Error('Comparison unavailable') });

      expect(screen.getByText('Comparison unavailable')).toBeTruthy();
    });
  });

  describe('when there is nothing to compare', () => {
    it('says so', () => {
      renderComparison({ comparison: { baselineId: BASELINE_ID, items: [] } });

      expect(screen.getByText('No comparison data')).toBeTruthy();
    });
  });
});
