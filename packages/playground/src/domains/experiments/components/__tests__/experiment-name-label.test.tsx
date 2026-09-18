import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExperimentDescriptionLabel, ExperimentNameLabel } from '../experiment-name-label';
import { experiments } from './fixtures/experiments';
import { getExperimentDisplayName } from '@/domains/experiments/utils/experiment-display-name';

const base = experiments[0];

afterEach(cleanup);

describe('getExperimentDisplayName', () => {
  it('returns the name when set', () => {
    expect(getExperimentDisplayName({ id: 'abcdef1234567890', name: 'Baseline run' })).toBe('Baseline run');
  });

  it('falls back to a readable short id when unnamed', () => {
    expect(getExperimentDisplayName({ id: 'abcdef1234567890', name: null })).toBe('Experiment #abcdef12');
  });
});

describe('ExperimentNameLabel', () => {
  it('renders the name on a single line', () => {
    render(<ExperimentNameLabel experiment={{ ...base, name: 'Baseline run', description: 'Nightly check' }} />);
    expect(screen.getByText('Baseline run')).toBeDefined();
    expect(screen.queryByText('Nightly check')).toBeNull();
  });

  it('falls back to a readable id when unnamed', () => {
    render(<ExperimentNameLabel experiment={{ ...base, id: 'abcdef1234567890', name: null }} />);
    expect(screen.getByText('Experiment #abcdef12')).toBeDefined();
  });
});

describe('ExperimentDescriptionLabel', () => {
  it('renders the description truncated to one line', () => {
    render(<ExperimentDescriptionLabel experiment={{ ...base, description: 'Nightly check' }} />);
    expect(screen.getByText('Nightly check').className).toContain('truncate');
  });

  it('shows a placeholder when there is no description', () => {
    render(<ExperimentDescriptionLabel experiment={{ ...base, description: null }} />);
    expect(screen.getByText('—')).toBeDefined();
  });
});
