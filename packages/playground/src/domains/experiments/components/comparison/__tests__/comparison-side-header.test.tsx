import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComparisonSideHeader } from '../comparison-side-header';
import { blankNameExperiment, namedExperiment, unnamedExperiment } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';

function renderColumn(ui: ReactElement) {
  return render(<TestLinkProvider>{ui}</TestLinkProvider>);
}

const summaryRegion = () => screen.getByRole('region', { name: 'Summary' });

describe('ComparisonSideHeader', () => {
  afterEach(cleanup);

  describe('when the experiment has a name', () => {
    it('labels the experiment link with the name and links to its full id', () => {
      renderColumn(<ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} />);

      const link = screen.getByRole('link', { name: 'Open experiment entity-extraction / model-a' });
      expect(link.getAttribute('href')).toBe(`/experiments/${namedExperiment.id}`);
    });

    it('links to the experiment page in the same tab', () => {
      renderColumn(<ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} />);

      const link = screen.getByRole('link', { name: 'Open experiment entity-extraction / model-a' });
      expect(link.getAttribute('target')).toBeNull();
      expect(link.getAttribute('rel')).toBeNull();
    });
  });

  describe('when the experiment has no usable name', () => {
    it('falls back to the shortened id as the link label', () => {
      renderColumn(<ComparisonSideHeader role="contender" label="Contender 1" experiment={unnamedExperiment} />);

      expect(screen.getByRole('link', { name: 'Open experiment c0ffee00' })).toBeDefined();
      expect(screen.queryByText(unnamedExperiment.id)).toBeNull();
    });

    it('falls back to the shortened id when the name is an empty string', () => {
      renderColumn(<ComparisonSideHeader role="contender" label="Contender 1" experiment={blankNameExperiment} />);

      expect(screen.getByRole('link', { name: 'Open experiment b1a11c00' })).toBeDefined();
    });
  });

  describe('when the two experiments used different dataset versions', () => {
    it('flags the dataset version inline instead of leaving it neutral', () => {
      renderColumn(
        <ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} versionMismatch />,
      );

      expect(screen.getByText(/different dataset version/)).toBeDefined();
    });

    it('leaves the version unflagged when both sides agree', () => {
      renderColumn(<ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} />);

      expect(screen.queryByText(/different dataset version/)).toBeNull();
    });
  });

  describe('when the experiment targets an agent', () => {
    it('links the agent name out to its playground page, without the target type prefix', () => {
      renderColumn(<ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} />);

      const link = screen.getByRole('link', { name: /example-entity-extraction-agent/ });
      expect(link.getAttribute('href')).toContain('/agents/example-entity-extraction-agent');
      expect(link.getAttribute('target')).toBeNull();
      expect(screen.queryByText(/agent \//)).toBeNull();
    });
  });

  describe('scorer summary', () => {
    const summary = [{ scorerId: 'relevancy', average: 0.75, delta: 0.25 }];

    it('shows the average per scorer', () => {
      renderColumn(
        <ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} summary={summary} />,
      );

      expect(screen.getByText('relevancy')).toBeDefined();
      // Same formatting as the per-item scores, so both read as one scale.
      expect(screen.getByText('0.75')).toBeDefined();
    });

    it('titles the summary above its key/value list', () => {
      renderColumn(
        <ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} summary={summary} />,
      );

      expect(screen.getByText('Summary')).toBeDefined();
      expect(screen.getByRole('region', { name: 'Summary' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Summary' })).toBeNull();
    });

    it('links each scorer out to its playground page', () => {
      renderColumn(
        <ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} summary={summary} />,
      );

      const link = screen.getByRole('link', { name: 'Open relevancy' });
      expect(link.getAttribute('href')).toContain('/scorers/relevancy');
      expect(link.getAttribute('target')).toBeNull();
    });

    it('only renders the delta on the side that carries it', () => {
      renderColumn(
        <ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} summary={summary} />,
      );

      expect(screen.queryByText('0.25', { exact: false })).toBeNull();
    });

    it('renders the delta on a contender', () => {
      renderColumn(
        <ComparisonSideHeader role="contender" label="Contender 1" experiment={namedExperiment} summary={summary} />,
      );

      expect(screen.getByText('0.25', { exact: false })).toBeDefined();
    });
  });

  describe('when the run metrics are known', () => {
    const metrics = { errorCount: 1, averageScore: 0.5, averageDurationMs: 1500 };

    it('summarizes errors, average score and average duration', () => {
      renderColumn(
        <ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} metrics={metrics} />,
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
        <ComparisonSideHeader
          role="baseline"
          label="Baseline"
          experiment={namedExperiment}
          metrics={{ ...metrics, errorCount: 0, averageScore: null, averageDurationMs: null }}
        />,
      );

      expect(screen.getAllByText('-')).toHaveLength(2);
    });

    it('does not trend the baseline against itself', () => {
      renderColumn(
        <ComparisonSideHeader
          role="baseline"
          label="Baseline"
          experiment={namedExperiment}
          metrics={metrics}
          baselineMetrics={metrics}
        />,
      );

      expect(screen.queryByText('+', { exact: false })).toBeNull();
    });

    it('trends a contender against the baseline, lower durations and errors reading as improvements', () => {
      renderColumn(
        <ComparisonSideHeader
          role="contender"
          label="Contender 1"
          experiment={namedExperiment}
          metrics={{ ...metrics, errorCount: 0, averageScore: 0.8, averageDurationMs: 1000 }}
          baselineMetrics={metrics}
        />,
      );

      expect(screen.getByText('+0.30').className).toContain('text-success-indicator');
      expect(screen.getByText('-500ms').className).toContain('text-success-indicator');
    });
  });

  describe('when the total cost is known', () => {
    const metrics = {
      errorCount: 0,
      averageScore: 0.5,
      averageDurationMs: 1500,
      cost: { value: 0.0015, unit: 'usd' },
      tokens: { value: 12400 },
    };

    it('lists the total cost, the average duration and the total tokens first', () => {
      renderColumn(
        <ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} metrics={metrics} />,
      );

      const terms = within(summaryRegion())
        .getAllByRole('term')
        .map(term => term.textContent);
      expect(terms.slice(0, 3)).toEqual(['Total cost', 'Avg duration', 'Total tokens']);
      expect(within(summaryRegion()).getByText('$0.0015')).toBeDefined();
      expect(within(summaryRegion()).getByText('12,400')).toBeDefined();
    });

    it('emphasizes the total cost and the average duration values with a larger, bolder font', () => {
      renderColumn(
        <ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} metrics={metrics} />,
      );

      const valueOf = (label: string) =>
        within(summaryRegion())
          .getAllByRole('term')
          .find(term => term.textContent === label)?.nextElementSibling;
      for (const term of ['Total cost', 'Avg duration']) {
        expect(valueOf(term)?.className).toContain('text-heading');
        expect(valueOf(term)?.className).toContain('font-semibold');
      }
      expect(valueOf('Total tokens')?.className).not.toContain('font-semibold');
      expect(valueOf('Errors')?.className).not.toContain('font-semibold');
    });
  });

  describe('when a contender uses fewer tokens than the baseline', () => {
    it('shows the saving as an improvement', () => {
      const baselineMetrics = { errorCount: 0, averageScore: 0.5, averageDurationMs: 1500, tokens: { value: 12400 } };
      renderColumn(
        <ComparisonSideHeader
          role="contender"
          label="Contender 1"
          experiment={namedExperiment}
          metrics={{ ...baselineMetrics, tokens: { value: 10000 } }}
          baselineMetrics={baselineMetrics}
        />,
      );

      expect(screen.getByText('-2,400').className).toContain('text-success-indicator');
    });
  });

  describe('when a contender is cheaper than the baseline', () => {
    it('shows the saving as an improvement', () => {
      const baselineMetrics = {
        errorCount: 0,
        averageScore: 0.5,
        averageDurationMs: 1500,
        cost: { value: 0.003, unit: 'usd' },
      };
      renderColumn(
        <ComparisonSideHeader
          role="contender"
          label="Contender 1"
          experiment={namedExperiment}
          metrics={{ ...baselineMetrics, cost: { value: 0.002, unit: 'usd' } }}
          baselineMetrics={baselineMetrics}
        />,
      );

      expect(screen.getByText('-$0.001').className).toContain('text-success-indicator');
    });
  });

  describe('when the two experiments use different cost units', () => {
    it('shows the cost without a difference', () => {
      const baselineMetrics = {
        errorCount: 0,
        averageScore: 0.5,
        averageDurationMs: 1500,
        cost: { value: 0.003, unit: 'usd' },
      };
      renderColumn(
        <ComparisonSideHeader
          role="contender"
          label="Contender 1"
          experiment={namedExperiment}
          metrics={{ ...baselineMetrics, cost: { value: 0.002, unit: 'eur' } }}
          baselineMetrics={baselineMetrics}
        />,
      );

      expect(screen.getByText('€0.002')).toBeDefined();
      expect(screen.queryByText(/[+-][$€]/)).toBeNull();
    });
  });

  describe('when metrics are unsupported', () => {
    it('leaves the total cost and the total tokens out of the summary', () => {
      renderColumn(
        <ComparisonSideHeader
          role="baseline"
          label="Baseline"
          experiment={namedExperiment}
          metrics={{ errorCount: 0, averageScore: 0.5, averageDurationMs: 1500 }}
        />,
      );

      expect(screen.queryByText('Total cost')).toBeNull();
      expect(screen.queryByText('Total tokens')).toBeNull();
    });
  });

  describe('when the header belongs to a contender that can become the baseline', () => {
    it('asks to set that contender as the baseline', () => {
      const onSetBaseline = vi.fn();
      renderColumn(
        <ComparisonSideHeader
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
      renderColumn(<ComparisonSideHeader role="baseline" label="Baseline" experiment={namedExperiment} />);

      expect(screen.queryByRole('button', { name: 'Set as baseline' })).toBeNull();
    });
  });

  describe('when the header has a label', () => {
    it('shows that label as the column badge', () => {
      renderColumn(<ComparisonSideHeader role="contender" label="Contender 2" experiment={namedExperiment} />);

      expect(screen.getByText('Contender 2')).toBeDefined();
    });
  });
});
