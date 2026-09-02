import { cleanup, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentsList } from '../experiments-list';
import { experiments, noAgents, noProcessors, noScorers, noWorkflows } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

function renderList(ui: ReactElement) {
  return renderWithProviders(<TestLinkProvider>{ui}</TestLinkProvider>);
}

describe('ExperimentsList', () => {
  afterEach(cleanup);

  // The target column resolves names through the registries; empty ones fall back to ids.
  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
      http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
      http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
      http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    );
  });

  describe('when experiments have names', () => {
    it('shows each experiment name as the primary label', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

      expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
      expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
    });

    it('shows the description beneath a named experiment', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

      expect(screen.getByText('Entity extraction evaluation using Model B')).toBeDefined();
    });

    it('links each row to the experiment by its full id', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} search="model-a" />);

      const link = screen.getByRole('link', { name: /entity-extraction \/ model-a/ });
      expect(link.getAttribute('href')).toBe('/experiments/a1b2c3d4-0000-0000-0000-000000000001');
      // The name and its description both live inside that one row link.
      expect(within(link).getByText(experiments[0].description!)).toBeDefined();
    });
  });

  describe('when an experiment has no name', () => {
    it('falls back to a readable id as the label', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

      expect(screen.getByText('Experiment #c0ffee00')).toBeDefined();
    });
  });

  describe('when an experiment name is an empty string', () => {
    it('falls back to a readable id as the label', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

      expect(screen.getByText('Experiment #b1a11c00')).toBeDefined();
    });

    it('still links the row to the experiment by its full id', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} />);

      const link = screen.getByRole('link', { name: /b1a11c00/ });
      expect(link.getAttribute('href')).toBe('/experiments/b1a11c00-0000-0000-0000-000000000004');
    });
  });

  describe('when an experiment has finished', () => {
    it('qualifies the status as the run finishing, not the scores being good', () => {
      renderList(<ExperimentsList experiments={experiments} isLoading={false} search="model-a" />);

      expect(screen.getByText('Run completed')).toBeDefined();
      expect(screen.queryByText('completed')).toBeNull();
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
