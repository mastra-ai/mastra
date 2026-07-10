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

  it('labels the experiment link with its name and links to the experiment by full id', () => {
    renderCard(<ExperimentInComparisonInfo datasetId="dataset-1" experiment={namedExperiment} type="baseline" />);

    const link = screen.getByRole('link', { name: 'entity-extraction / model-a' });
    expect(link.getAttribute('href')).toBe(`/datasets/dataset-1/experiments/${namedExperiment.id}`);
    // The short id remains visible as secondary detail.
    expect(screen.getByText('a1b2c3d4')).toBeDefined();
  });

  it('falls back to the full id as the link label when the experiment has no name', () => {
    renderCard(<ExperimentInComparisonInfo datasetId="dataset-1" experiment={unnamedExperiment} type="contender" />);

    expect(screen.getByRole('link', { name: unnamedExperiment.id })).toBeDefined();
  });
});
