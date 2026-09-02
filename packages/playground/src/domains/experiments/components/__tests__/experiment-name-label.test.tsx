import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExperimentNameLabel } from '../experiment-name-label';
import { experiments } from './fixtures/experiments';

const base = experiments[0];

afterEach(cleanup);

describe('ExperimentNameLabel', () => {
  it('shows the name with the description underneath when both exist', () => {
    render(<ExperimentNameLabel experiment={{ ...base, name: 'Baseline run', description: 'Nightly check' }} />);
    expect(screen.getByText('Baseline run')).toBeDefined();
    expect(screen.getByText('Nightly check')).toBeDefined();
  });

  it('falls back to a readable id and the version/scorer summary when unnamed', () => {
    render(
      <ExperimentNameLabel
        experiment={{
          ...base,
          id: 'abcdef1234567890',
          name: null,
          description: null,
          datasetVersion: 3,
          scorerIds: ['a', 'b'],
        }}
      />,
    );
    expect(screen.getByText('Experiment #abcdef12')).toBeDefined();
    expect(screen.getByText('v3 · 2 scorers')).toBeDefined();
  });

  it('uses the singular scorer label and omits the version when unknown', () => {
    render(
      <ExperimentNameLabel
        experiment={{ ...base, name: 'Single', description: null, datasetVersion: null, scorerIds: ['a'] }}
      />,
    );
    expect(screen.getByText('1 scorer')).toBeDefined();
  });

  it('renders only the primary line when there is nothing to summarise', () => {
    const { container } = render(
      <ExperimentNameLabel
        experiment={{ ...base, name: 'Bare', description: null, datasetVersion: null, scorerIds: null }}
      />,
    );
    expect(screen.getByText('Bare')).toBeDefined();
    expect(container.querySelectorAll('span').length).toBe(2);
  });
});
