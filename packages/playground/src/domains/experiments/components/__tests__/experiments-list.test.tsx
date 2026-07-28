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

  describe('when experiments have names', () => {
    it('shows each experiment name as the primary label', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

      expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
      expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
    });

    it('shows the shortened id beneath a named experiment', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

      expect(screen.getByText('a1b2c3d4')).toBeDefined();
    });

    it('links each row to the experiment by its full id', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} search="model-a" />);

      const link = screen.getByRole('link', { name: /entity-extraction \/ model-a/ });
      expect(link.getAttribute('href')).toBe('/experiments/a1b2c3d4-0000-0000-0000-000000000001');
      // The name and its short id both live inside that one row link.
      expect(within(link).getByText('a1b2c3d4')).toBeDefined();
    });
  });

  describe('when an experiment has no name', () => {
    it('falls back to its shortened id as the label', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

      expect(screen.getByText('c0ffee00')).toBeDefined();
    });
  });

  describe('when a search term matches an experiment name', () => {
    it('shows only the matching experiment', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} search="model-b" />);

      expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
      expect(screen.queryByText('entity-extraction / model-a')).toBeNull();
    });
  });
});
