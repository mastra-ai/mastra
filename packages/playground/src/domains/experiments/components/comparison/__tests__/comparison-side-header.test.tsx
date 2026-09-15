import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComparisonSideHeader } from '../comparison-side-header';
import { blankNameExperiment, namedExperiment, unnamedExperiment } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';

function renderColumn(ui: ReactElement) {
  return render(<TestLinkProvider>{ui}</TestLinkProvider>);
}

describe('ComparisonSideHeader', () => {
  afterEach(cleanup);

  describe('when the experiment has a name', () => {
    it('labels the experiment link with the name and links to its full id', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} />);

      const link = screen.getByRole('link', { name: 'Open experiment entity-extraction / model-a' });
      expect(link.getAttribute('href')).toBe(`/experiments/${namedExperiment.id}`);
    });

    it('links to the experiment page in the same tab', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} />);

      const link = screen.getByRole('link', { name: 'Open experiment entity-extraction / model-a' });
      expect(link.getAttribute('target')).toBeNull();
      expect(link.getAttribute('rel')).toBeNull();
    });

    it('keeps the shortened id visible as secondary detail', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} />);

      expect(screen.getByText('a1b2c3d4')).toBeDefined();
    });
  });

  describe('when the experiment has no usable name', () => {
    it('falls back to the shortened id as the link label', () => {
      renderColumn(<ComparisonSideHeader side="contender" experiment={unnamedExperiment} />);

      expect(screen.getByRole('link', { name: 'Open experiment c0ffee00' })).toBeDefined();
      expect(screen.queryByText(unnamedExperiment.id)).toBeNull();
    });

    it('falls back to the shortened id when the name is an empty string', () => {
      renderColumn(<ComparisonSideHeader side="contender" experiment={blankNameExperiment} />);

      expect(screen.getByRole('link', { name: 'Open experiment b1a11c00' })).toBeDefined();
    });
  });

  describe('when the two experiments used different dataset versions', () => {
    it('flags the dataset version inline instead of leaving it neutral', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} versionMismatch />);

      expect(screen.getByText(/different dataset version/)).toBeDefined();
    });

    it('leaves the version unflagged when both sides agree', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} />);

      expect(screen.queryByText(/different dataset version/)).toBeNull();
    });
  });

  describe('when the experiment targets an agent', () => {
    it('links the agent name out to its playground page, without the target type prefix', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} />);

      const link = screen.getByRole('link', { name: /example-entity-extraction-agent/ });
      expect(link.getAttribute('href')).toContain('/agents/example-entity-extraction-agent');
      expect(link.getAttribute('target')).toBeNull();
      expect(screen.queryByText(/agent \//)).toBeNull();
    });
  });

  describe('scorer summary', () => {
    const summary = [{ scorerId: 'relevancy', average: 0.75, delta: 0.25 }];

    it('shows the average per scorer', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} summary={summary} />);

      expect(screen.getByText('relevancy')).toBeDefined();
      // Same formatting as the per-item scores, so both read as one scale.
      expect(screen.getByText('0.75')).toBeDefined();
    });

    it('titles the summary as a collapsible overall score section', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} summary={summary} />);

      expect(screen.getByRole('button', { name: 'Overall score' })).toBeDefined();
    });

    it('links each scorer out to its playground page', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} summary={summary} />);

      const link = screen.getByRole('link', { name: 'Open relevancy' });
      expect(link.getAttribute('href')).toContain('/scorers/relevancy');
      expect(link.getAttribute('target')).toBeNull();
    });

    it('only renders the delta on the side that carries it', () => {
      renderColumn(<ComparisonSideHeader side="baseline" experiment={namedExperiment} summary={summary} />);

      expect(screen.queryByText('0.25', { exact: false })).toBeNull();
    });

    it('renders the delta on the contender', () => {
      renderColumn(<ComparisonSideHeader side="contender" experiment={namedExperiment} summary={summary} showDeltas />);

      expect(screen.getByText('0.25', { exact: false })).toBeDefined();
    });
  });
});
