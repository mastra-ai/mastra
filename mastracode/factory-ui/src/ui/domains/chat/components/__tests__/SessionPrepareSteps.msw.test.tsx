/**
 * Focused coverage of the `<SessionPrepareSteps>` loader: renders the
 * canonical six-phase list and marks each step pending / active / complete
 * based on `sandboxProgress.phase` from `ChatSessionContext`.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PrepareProgress } from '../../../workspaces/services/github';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { SessionPrepareSteps } from '../SessionPrepareSteps';

const BASE_SESSION: ChatSessionContextApi = {
  resourceId: 'session-1',
  sessionEnabled: false,
  resourceReady: true,
  sandboxReady: false,
  sandboxPreparing: true,
  sandboxProgress: undefined,
  resourceEnabled: true,
  baseUrl: 'http://test',
  kind: 'factory',
};

function renderWithProgress(sandboxProgress: PrepareProgress | undefined) {
  return render(
    <ChatSessionContext.Provider value={{ ...BASE_SESSION, sandboxProgress }}>
      <SessionPrepareSteps />
    </ChatSessionContext.Provider>,
  );
}

function stepByLabel(label: string) {
  const labelNode = screen.getByText(label);
  const stepRoot = labelNode.closest('[data-testid="session-prepare-step"]');
  if (!stepRoot) throw new Error(`Could not find step root for label ${label}`);
  return stepRoot as HTMLElement;
}

describe('SessionPrepareSteps', () => {
  it('renders the canonical phase list before any progress arrives, with reattaching as active and Starting… secondary text', () => {
    renderWithProgress(undefined);

    // Landmark + all six ordered phases.
    expect(screen.getByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    const canonicalLabels = [
      'Reattaching to sandbox',
      'Provisioning sandbox',
      'Preparing workspace',
      'Cloning repository',
      'Fetching latest changes',
      'Finalizing session',
    ];
    for (const label of canonicalLabels) expect(screen.getByText(label)).toBeInTheDocument();

    expect(stepByLabel('Reattaching to sandbox')).toHaveAttribute('data-status', 'active');
    expect(within(stepByLabel('Reattaching to sandbox')).getByText('Starting…')).toBeInTheDocument();
    for (const label of canonicalLabels.slice(1)) {
      expect(stepByLabel(label)).toHaveAttribute('data-status', 'pending');
    }
  });

  it('advances the active/complete/pending statuses as the observed phase moves forward', () => {
    const { rerender } = renderWithProgress({ phase: 'provisioning', message: 'Provisioning a new sandbox…' });

    expect(stepByLabel('Reattaching to sandbox')).toHaveAttribute('data-status', 'complete');
    expect(stepByLabel('Provisioning sandbox')).toHaveAttribute('data-status', 'active');
    expect(within(stepByLabel('Provisioning sandbox')).getByText('Provisioning a new sandbox…')).toBeInTheDocument();
    expect(stepByLabel('Cloning repository')).toHaveAttribute('data-status', 'pending');

    rerender(
      <ChatSessionContext.Provider
        value={{ ...BASE_SESSION, sandboxProgress: { phase: 'cloning', message: 'Cloning octo/hello…' } }}
      >
        <SessionPrepareSteps />
      </ChatSessionContext.Provider>,
    );

    expect(stepByLabel('Provisioning sandbox')).toHaveAttribute('data-status', 'complete');
    expect(stepByLabel('Cloning repository')).toHaveAttribute('data-status', 'active');
    expect(within(stepByLabel('Cloning repository')).getByText('Cloning octo/hello…')).toBeInTheDocument();
    // Prior secondary text unmounts with the completed step.
    expect(screen.queryByText('Provisioning a new sandbox…')).not.toBeInTheDocument();
  });

  it('marks provisioning as skipped when the observed phase is reattaching', () => {
    renderWithProgress({ phase: 'reattaching', message: 'Reattaching…' });

    expect(stepByLabel('Reattaching to sandbox')).toHaveAttribute('data-status', 'active');
    expect(stepByLabel('Provisioning sandbox')).toHaveAttribute('data-status', 'skipped');
    expect(stepByLabel('Cloning repository')).toHaveAttribute('data-status', 'pending');
  });

  it('falls back to just the canonical label when no server message is present on the active step', () => {
    renderWithProgress({ phase: 'cloning', message: '' });

    const activeStep = stepByLabel('Cloning repository');
    expect(activeStep).toHaveAttribute('data-status', 'active');
    // Only the canonical label renders — no secondary text-xs paragraph.
    expect(activeStep.querySelectorAll('span')).toHaveLength(1);
  });
});
