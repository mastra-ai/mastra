// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentHeaderActions } from '../experiment-header-actions';
import type { ExperimentHeaderActionsProps } from '../experiment-header-actions';
import { completedExperiment } from './fixtures/experiments';

const namedExperiment = completedExperiment;

const renderActions = (props: Partial<Omit<ExperimentHeaderActionsProps, 'experiment'>> = {}) =>
  render(<ExperimentHeaderActions experiment={namedExperiment} {...props} />);

const openMenu = async () => fireEvent.click(await screen.findByRole('button', { name: 'Experiment actions menu' }));

describe('ExperimentHeaderActions', () => {
  afterEach(cleanup);

  describe('when the host can rename the experiment', () => {
    it('opens the rename dialog from the actions menu', async () => {
      renderActions({ onRename: async () => {} });

      await openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /rename experiment/i }));

      expect(await screen.findByRole('dialog', { name: /rename experiment/i })).toBeDefined();
      expect(screen.queryByRole('menuitem', { name: /delete experiment/i })).toBeNull();
    });
  });

  describe('when the host can delete the experiment', () => {
    it('calls the delete handler from the actions menu', async () => {
      const onDeleteClick = vi.fn();
      renderActions({ onDeleteClick });

      await openMenu();
      fireEvent.click(await screen.findByRole('menuitem', { name: /delete experiment/i }));

      expect(onDeleteClick).toHaveBeenCalledOnce();
    });
  });

  describe('when the host can neither rename nor delete', () => {
    it('renders no actions menu', () => {
      renderActions();

      expect(screen.queryByRole('button', { name: 'Experiment actions menu' })).toBeNull();
    });
  });

  describe('when the host passes a rerun action', () => {
    it('renders it before the actions menu', () => {
      renderActions({ rerunSlot: <button type="button">Rerun</button>, onDeleteClick: () => {} });

      const rerun = screen.getByRole('button', { name: 'Rerun' });
      const menu = screen.getByRole('button', { name: 'Experiment actions menu' });
      expect(rerun.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
