import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComparisonSideSummary, ComparisonSideTitle } from '../comparison-side-header';
import { blankNameExperiment, datasetlessExperiment, namedExperiment, unnamedExperiment } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';

function renderColumn(ui: ReactElement) {
  return render(<TestLinkProvider>{ui}</TestLinkProvider>);
}

const summaryRegion = () => screen.getByRole('region', { name: 'Summary' });

describe('ComparisonSideSummary', () => {
  afterEach(cleanup);

  describe('when the experiment ran on a dataset version', () => {
    it('links the version to the dataset at that version', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} />);

      const link = screen.getByRole('link', { name: 'Open dataset v3' });
      expect(link.getAttribute('href')).toBe('/datasets/dataset-1?version=3');
    });
  });

  describe('when the two experiments used different dataset versions', () => {
    it('flags the dataset version inline instead of leaving it neutral', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} versionMismatch />);

      expect(screen.getByText(/differs from baseline/)).toBeDefined();
    });

    it('leaves the version unflagged when both sides agree', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} />);

      expect(screen.queryByText(/differs from baseline/)).toBeNull();
    });
  });

  describe('when the experiment targets an agent', () => {
    it('links the agent name out to its playground page, without the target type prefix', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} />);

      const link = screen.getByRole('link', { name: /example-entity-extraction-agent/ });
      expect(link.getAttribute('href')).toContain('/agents/example-entity-extraction-agent');
      expect(link.getAttribute('target')).toBeNull();
      expect(screen.queryByText(/agent \//)).toBeNull();
    });
  });

  const summary = [{ scorerId: 'relevancy', average: 0.75, delta: 0.25 }];

  describe('scorer summary', () => {
    it('shows the average per scorer', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} summary={summary} />);

      expect(screen.getByText('relevancy')).toBeDefined();
      // Same formatting as the per-item scores, so both read as one scale.
      expect(screen.getByText('0.75')).toBeDefined();
    });

    it('titles the summary above its key/value list', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} summary={summary} />);

      expect(screen.getByText('Summary')).toBeDefined();
      expect(screen.getByRole('region', { name: 'Summary' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Summary' })).toBeNull();
    });

    it('links each scorer out to its playground page', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} summary={summary} />);

      const link = screen.getByRole('link', { name: 'Open relevancy' });
      expect(link.getAttribute('href')).toContain('/scorers/relevancy');
      expect(link.getAttribute('target')).toBeNull();
    });

    it('only renders the delta on the side that carries it', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} summary={summary} />);

      expect(screen.queryByText('50.0%', { exact: false })).toBeNull();
    });

    it('renders the delta on a contender as a percentage of the baseline average', () => {
      renderColumn(<ComparisonSideSummary role="contender" experiment={namedExperiment} summary={summary} />);

      // 0.75 is 0.25 above a 0.50 baseline.
      expect(screen.getByText('+50.0%')).toBeDefined();
    });
  });

  describe('when a scorer labels its scores', () => {
    const labelled = [
      { scorerId: 'safety-grade', average: 0.8, delta: null, labelCounts: { exemplary: 4, failing: 1 } },
    ];

    it('lists how many items got each label under the scorer average, most frequent first', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} summary={labelled} />);

      const value = within(summaryRegion()).getByText('0.80').closest('dd');
      expect(value?.textContent).toBe('0.80exemplary 4 · failing 1');
    });

    it('shows only the average for a scorer without labels', () => {
      renderColumn(<ComparisonSideSummary role="baseline" experiment={namedExperiment} summary={summary} />);

      expect(within(summaryRegion()).getByText('0.75').closest('dd')?.textContent).toBe('0.75');
    });
  });

  describe('when the run metrics are known', () => {
    const metrics = { errorCount: 1, averageScore: 0.5, averageDurationMs: 1500 };
    const summary = [{ scorerId: 'relevancy', average: 0.75, delta: null }];

    it('summarizes errors, average score and average duration', () => {
      renderColumn(
        <ComparisonSideSummary role="baseline" experiment={namedExperiment} metrics={metrics} summary={summary} />,
      );

      expect(screen.queryByText('Items')).toBeNull();
      expect(screen.getByText('Errors')).toBeDefined();
      expect(screen.getByText('1')).toBeDefined();
      expect(screen.getByText('Avg score')).toBeDefined();
      expect(screen.getByText('0.50')).toBeDefined();
      expect(screen.getByText('Avg duration')).toBeDefined();
    });

    it('shows a dash for a metric that cannot be computed', () => {
      renderColumn(
        <ComparisonSideSummary
          role="baseline"
          experiment={namedExperiment}
          metrics={{ ...metrics, errorCount: 0, averageScore: null, averageDurationMs: null }}
          summary={summary}
        />,
      );

      expect(screen.getAllByText('-')).toHaveLength(2);
    });

    it('does not trend the baseline against itself', () => {
      renderColumn(
        <ComparisonSideSummary
          role="baseline"
          experiment={namedExperiment}
          metrics={metrics}
          baselineMetrics={metrics}
          summary={summary}
        />,
      );

      expect(screen.queryByText('+', { exact: false })).toBeNull();
    });

    it('trends a contender against the baseline, lower durations and errors reading as improvements', () => {
      renderColumn(
        <ComparisonSideSummary
          role="contender"
          experiment={namedExperiment}
          metrics={{ ...metrics, errorCount: 0, averageScore: 0.8, averageDurationMs: 1000 }}
          baselineMetrics={metrics}
          summary={summary}
        />,
      );

      expect(screen.getByText('+60.0%').className).toContain('text-success-indicator');
      expect(screen.getByText('-33.3%').className).toContain('text-success-indicator');
    });
  });

  describe('when the compared experiments have no scorers', () => {
    it('leaves the average score out of the summary', () => {
      renderColumn(
        <ComparisonSideSummary
          role="baseline"
          experiment={namedExperiment}
          metrics={{ errorCount: 0, averageScore: null, averageDurationMs: 1500 }}
          summary={[]}
        />,
      );

      expect(screen.getByText('Errors')).toBeDefined();
      expect(screen.queryByText('Avg score')).toBeNull();
    });
  });

  describe('when the total cost is known', () => {
    const metrics = {
      errorCount: 0,
      averageScore: 0.5,
      averageDurationMs: 1500,
      cost: 0.0015,
      costUnit: 'usd',
      tokens: 12400,
    };
    const summary = [{ scorerId: 'relevancy', average: 0.5, delta: null }];

    it('lists the total cost, the average duration, the average score and the total tokens first', () => {
      renderColumn(
        <ComparisonSideSummary
          role="baseline"
          experiment={namedExperiment}
          metrics={metrics}
          summary={summary}
          showUsage
        />,
      );

      const terms = within(summaryRegion())
        .getAllByRole('term')
        .map(term => term.textContent);
      expect(terms.slice(0, 4)).toEqual(['Total cost', 'Avg duration', 'Avg score', 'Total tokens']);
      expect(within(summaryRegion()).getByText('$0.002')).toBeDefined();
      expect(within(summaryRegion()).getByText('12,400')).toBeDefined();
    });

    it('emphasizes the total cost, the average duration and the average score values with a larger, bolder font', () => {
      renderColumn(
        <ComparisonSideSummary
          role="baseline"
          experiment={namedExperiment}
          metrics={metrics}
          summary={summary}
          showUsage
        />,
      );

      const valueOf = (label: string) =>
        within(summaryRegion())
          .getAllByRole('term')
          .find(term => term.textContent === label)?.nextElementSibling;
      for (const term of ['Total cost', 'Avg duration', 'Avg score']) {
        expect(valueOf(term)?.className).toContain('text-heading');
        expect(valueOf(term)?.className).toContain('font-semibold');
      }
      expect(valueOf('Total tokens')?.className).not.toContain('font-semibold');
      expect(valueOf('Errors')?.className).not.toContain('font-semibold');
    });
  });

  describe('when a contender uses fewer tokens than the baseline', () => {
    it('shows the saving as an improvement', () => {
      const baselineMetrics = { errorCount: 0, averageScore: 0.5, averageDurationMs: 1500, tokens: 12400 };
      renderColumn(
        <ComparisonSideSummary
          role="contender"
          experiment={namedExperiment}
          metrics={{ ...baselineMetrics, tokens: 10000 }}
          baselineMetrics={baselineMetrics}
          showUsage
        />,
      );

      expect(screen.getByText('-19.4%').className).toContain('text-success-indicator');
    });
  });

  describe('when a contender is cheaper than the baseline', () => {
    it('shows the saving as an improvement', () => {
      const baselineMetrics = {
        errorCount: 0,
        averageScore: 0.5,
        averageDurationMs: 1500,
        cost: 0.003,
        costUnit: 'usd',
      };
      renderColumn(
        <ComparisonSideSummary
          role="contender"
          experiment={namedExperiment}
          metrics={{ ...baselineMetrics, cost: 0.002 }}
          baselineMetrics={baselineMetrics}
          showUsage
        />,
      );

      expect(screen.getByText('-33.3%').className).toContain('text-success-indicator');
    });
  });

  describe('when the two experiments use different cost units', () => {
    it('shows the cost without a difference', () => {
      const baselineMetrics = {
        errorCount: 0,
        averageScore: 0.5,
        averageDurationMs: 1500,
        cost: 0.003,
        costUnit: 'usd',
      };
      renderColumn(
        <ComparisonSideSummary
          role="contender"
          experiment={namedExperiment}
          metrics={{ ...baselineMetrics, cost: 0.002, costUnit: 'eur' }}
          baselineMetrics={baselineMetrics}
          showUsage
        />,
      );

      expect(screen.getByText('€0.002')).toBeDefined();
      expect(screen.queryByText(/[+-][$€]/)).toBeNull();
    });
  });

  describe('when usage is shown but the experiment has no usage', () => {
    it('shows a dash for the total cost and the total tokens', () => {
      renderColumn(
        <ComparisonSideSummary
          role="baseline"
          experiment={namedExperiment}
          metrics={{ errorCount: 0, averageScore: 0.5, averageDurationMs: 1500 }}
          showUsage
        />,
      );

      const valueOf = (label: string) =>
        within(summaryRegion())
          .getAllByRole('term')
          .find(term => term.textContent === label)?.nextElementSibling?.textContent;
      expect(valueOf('Total cost')).toBe('-');
      expect(valueOf('Total tokens')).toBe('-');
    });
  });

  describe('when metrics are unsupported', () => {
    it('leaves the total cost and the total tokens out of the summary', () => {
      renderColumn(
        <ComparisonSideSummary
          role="baseline"
          experiment={namedExperiment}
          metrics={{ errorCount: 0, averageScore: 0.5, averageDurationMs: 1500, cost: 0.003, tokens: 12400 }}
        />,
      );

      expect(screen.queryByText('Total cost')).toBeNull();
      expect(screen.queryByText('Total tokens')).toBeNull();
    });
  });
});

describe('ComparisonSideTitle', () => {
  afterEach(cleanup);

  describe('when the experiment has a name', () => {
    const openMenu = () => {
      renderColumn(<ComparisonSideTitle role="baseline" label="Baseline" experiment={namedExperiment} />);
      fireEvent.click(screen.getByRole('button', { name: 'entity-extraction / model-a' }));
    };

    it('offers to view the experiment page, in the same tab', async () => {
      openMenu();

      const item = await screen.findByRole('menuitem', { name: 'View experiment' });
      expect(item.getAttribute('href')).toBe(`/experiments/${namedExperiment.id}`);
      expect(item.getAttribute('target')).toBeNull();
    });

    it('offers to rename the experiment', async () => {
      openMenu();

      expect(await screen.findByRole('menuitem', { name: 'Rename experiment' })).toBeDefined();
    });
  });

  describe('when the experiment has no usable name', () => {
    it('falls back to the shortened id as the title', () => {
      renderColumn(<ComparisonSideTitle role="contender" label="Contender 1" experiment={unnamedExperiment} />);

      expect(screen.getByRole('button', { name: 'c0ffee00' })).toBeDefined();
      expect(screen.queryByText(unnamedExperiment.id)).toBeNull();
    });

    it('falls back to the shortened id when the name is an empty string', () => {
      renderColumn(<ComparisonSideTitle role="contender" label="Contender 1" experiment={blankNameExperiment} />);

      expect(screen.getByRole('button', { name: 'b1a11c00' })).toBeDefined();
    });
  });

  describe('when the experiment belongs to no dataset', () => {
    it('does not offer to rename it', async () => {
      renderColumn(<ComparisonSideTitle role="baseline" label="Baseline" experiment={datasetlessExperiment} />);
      fireEvent.click(screen.getByRole('button', { name: 'entity-extraction / model-a' }));

      expect(await screen.findByRole('menuitem', { name: 'View experiment' })).toBeDefined();
      expect(screen.queryByRole('menuitem', { name: 'Rename experiment' })).toBeNull();
    });
  });

  describe('when the header belongs to a contender that can become the baseline', () => {
    it('asks to set that contender as the baseline', () => {
      const onSetBaseline = vi.fn();
      renderColumn(
        <ComparisonSideTitle
          role="contender"
          label="Contender 1"
          experiment={namedExperiment}
          onSetBaseline={onSetBaseline}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Set as baseline' }));

      expect(onSetBaseline).toHaveBeenCalledOnce();
    });
  });

  describe('when the header belongs to the baseline', () => {
    it('does not offer to set it as the baseline', () => {
      renderColumn(<ComparisonSideTitle role="baseline" label="Baseline" experiment={namedExperiment} />);

      expect(screen.queryByRole('button', { name: 'Set as baseline' })).toBeNull();
    });
  });

  describe('when the header has a label', () => {
    it('shows that label as the column badge', () => {
      renderColumn(<ComparisonSideTitle role="contender" label="Contender 2" experiment={namedExperiment} />);

      expect(screen.getByText('Contender 2')).toBeDefined();
    });
  });
});
