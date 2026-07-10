import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ExperimentsList } from '../experiments-list';
import { experiments } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';

function renderList(ui: ReactElement) {
  return render(<TestLinkProvider>{ui}</TestLinkProvider>);
}

describe('ExperimentsList', () => {
  afterEach(cleanup);

  it('shows each experiment name as the primary label with the short id beneath it', () => {
    renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

    expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
    expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
    // Named rows keep the short id as secondary detail.
    expect(screen.getByText('a1b2c3d4')).toBeDefined();
    // The unnamed experiment falls back to its short id as the label.
    expect(screen.getByText('c0ffee00')).toBeDefined();
  });

  it('filters the list by experiment name', () => {
    renderList(<ExperimentsList experiments={experiments} isLoading={false} search="model-b" />);

    expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
    expect(screen.queryByText('entity-extraction / model-a')).toBeNull();
  });

  it('links each row to the experiment by its full id', () => {
    renderList(<ExperimentsList experiments={experiments} isLoading={false} search="model-a" />);

    const link = screen.getByRole('link', { name: /entity-extraction \/ model-a/ });
    expect(link.getAttribute('href')).toBe('/experiments/a1b2c3d4-0000-0000-0000-000000000001');
    // The name and its short id both live inside that one row link.
    expect(within(link).getByText('a1b2c3d4')).toBeDefined();
  });
});
