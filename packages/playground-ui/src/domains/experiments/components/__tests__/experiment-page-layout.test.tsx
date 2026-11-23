// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentPageLayout } from '../experiment-page-layout';
import type { ExperimentPageLayoutProps } from '../experiment-page-layout';
import {
  completedExperiment,
  experimentWithErrors,
  runningExperiment,
  unnamedExperiment,
} from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';

const completed = completedExperiment;

const renderLayout = (props: Partial<ExperimentPageLayoutProps> = {}) =>
  render(
    <TestLinkProvider>
      <ExperimentPageLayout
        experimentsHref="/experiments"
        experimentId={completed.id}
        experiment={completed}
        {...props}
      >
        <p>Experiment body</p>
      </ExperimentPageLayout>
    </TestLinkProvider>,
  );

const breadcrumb = () => screen.getByRole('navigation', { name: 'Breadcrumb' });

describe('ExperimentPageLayout', () => {
  afterEach(cleanup);

  describe('given a settled experiment', () => {
    it('links the first crumb back to the experiments list', () => {
      renderLayout();

      const link = within(breadcrumb()).getByRole('link', { name: 'Experiments' });
      expect(link.getAttribute('href')).toBe('/experiments');
    });

    it('names the experiment as the current crumb with its item count', () => {
      renderLayout();

      const current = within(breadcrumb()).getByText('entity-extraction / model-a');
      expect(current.closest('[aria-current="page"]')).not.toBeNull();
      expect(within(breadcrumb()).getByText('10 items')).toBeDefined();
      expect(within(breadcrumb()).queryByText(/errored/)).toBeNull();
    });

    it('counts the errored items', () => {
      renderLayout({ experiment: experimentWithErrors });

      expect(within(breadcrumb()).getByText('3 errored')).toBeDefined();
    });

    it('renders the page body', () => {
      renderLayout();

      expect(screen.getByText('Experiment body')).toBeDefined();
    });

    it('offers the actions the host handles in the actions menu', async () => {
      const onDeleteClick = vi.fn();
      renderLayout({ onDeleteClick });

      fireEvent.click(await screen.findByRole('button', { name: 'Experiment actions menu' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: /delete experiment/i }));

      expect(onDeleteClick).toHaveBeenCalledOnce();
      expect(screen.queryByRole('menuitem', { name: /rename experiment/i })).toBeNull();
    });

    it('shows the rerun slot beside the menu', () => {
      renderLayout({ rerunSlot: <button type="button">Rerun</button> });

      expect(screen.getByRole('button', { name: 'Rerun' })).toBeDefined();
    });
  });

  describe('given a running experiment', () => {
    it('leaves the item count out until it settles', () => {
      renderLayout({ experiment: runningExperiment });

      expect(within(breadcrumb()).getByText('entity-extraction / model-a')).toBeDefined();
      expect(within(breadcrumb()).queryByText('10 items')).toBeNull();
    });
  });

  describe('given no experiment (loading, missing or forbidden)', () => {
    it('names the current crumb by its short id', () => {
      renderLayout({ experiment: undefined });

      expect(within(breadcrumb()).getByText('a1b2c3d4...')).toBeDefined();
    });

    it('has no actions menu', () => {
      renderLayout({ experiment: undefined, onDeleteClick: () => {} });

      expect(screen.queryByRole('button', { name: 'Experiment actions menu' })).toBeNull();
    });
  });

  describe('given an unnamed experiment', () => {
    it('names the current crumb by its short id', () => {
      renderLayout({ experiment: unnamedExperiment });

      expect(within(breadcrumb()).getByText('a1b2c3d4...')).toBeDefined();
    });
  });
});
