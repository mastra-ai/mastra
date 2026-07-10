import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExperimentInComparisonInfo } from '../experiment-in-comparison-info';
import { namedExperiment, unnamedExperiment } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';

function renderCard(ui: ReactElement) {
  return render(<TestLinkProvider>{ui}</TestLinkProvider>);
}

describe('ExperimentInComparisonInfo', () => {
  afterEach(cleanup);

  describe('when the experiment has a name', () => {
    it('labels the experiment link with the name', () => {
      renderCard(<ExperimentInComparisonInfo datasetId="dataset-1" experiment={namedExperiment} type="baseline" />);

      expect(screen.getByRole('link', { name: 'entity-extraction / model-a' })).toBeDefined();
    });

    it('links to the experiment by its full id', () => {
      renderCard(<ExperimentInComparisonInfo datasetId="dataset-1" experiment={namedExperiment} type="baseline" />);

      const link = screen.getByRole('link', { name: 'entity-extraction / model-a' });
      expect(link.getAttribute('href')).toBe(`/datasets/dataset-1/experiments/${namedExperiment.id}`);
    });

    it('keeps the shortened id visible as secondary detail', () => {
      renderCard(<ExperimentInComparisonInfo datasetId="dataset-1" experiment={namedExperiment} type="baseline" />);

      expect(screen.getByText('a1b2c3d4')).toBeDefined();
    });
  });

  describe('when the experiment has no name', () => {
    it('falls back to the shortened id as the link label', () => {
      renderCard(<ExperimentInComparisonInfo datasetId="dataset-1" experiment={unnamedExperiment} type="contender" />);

      expect(screen.getByRole('link', { name: 'c0ffee00' })).toBeDefined();
      expect(screen.queryByText(unnamedExperiment.id)).toBeNull();
    });
  });
});
