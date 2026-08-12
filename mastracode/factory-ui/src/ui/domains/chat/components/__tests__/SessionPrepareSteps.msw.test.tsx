/**
 * Focused coverage of the `<SessionPrepareSteps>` loader: renders three
 * user-facing groups ("Preparing sandbox" → "Cloning repository" →
 * "Starting session") and marks each step pending / running / success based
 * on `sandboxProgress.phase` from `ChatSessionContext`.
 *
 * SSE phase → group mapping:
 *   reattaching / provisioning / preparing-workspace  →  Preparing sandbox
 *   cloning / pulling                                 →  Cloning repository
 *   finalizing (+ post-ensure messages fetch)         →  Starting session
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
  it('renders exactly three user-facing groups in the canonical order', () => {
    renderWithProgress(undefined);
    expect(screen.getByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    const stepRoots = screen.getAllByTestId('session-prepare-step');
    expect(stepRoots).toHaveLength(3);
    expect(stepRoots[0]).toHaveTextContent('Preparing sandbox');
    expect(stepRoots[1]).toHaveTextContent('Cloning repository');
    expect(stepRoots[2]).toHaveTextContent('Starting session');
  });

  it('before any progress arrives, Preparing sandbox is active with the Starting… fallback message', () => {
    renderWithProgress(undefined);
    expect(stepByLabel('Preparing sandbox')).toHaveAttribute('data-status', 'running');
    expect(stepByLabel('Cloning repository')).toHaveAttribute('data-status', 'pending');
    expect(stepByLabel('Starting session')).toHaveAttribute('data-status', 'pending');
    expect(within(stepByLabel('Preparing sandbox')).getByText('Starting…')).toBeInTheDocument();
  });

  it('reattaching / provisioning / preparing-workspace all map to Preparing sandbox as active', () => {
    const phases: Array<PrepareProgress['phase']> = ['reattaching', 'provisioning', 'preparing-workspace'];
    for (const phase of phases) {
      const { unmount } = renderWithProgress({ phase, message: `msg for ${phase}` });
      expect(stepByLabel('Preparing sandbox')).toHaveAttribute('data-status', 'running');
      expect(within(stepByLabel('Preparing sandbox')).getByText(`msg for ${phase}`)).toBeInTheDocument();
      expect(stepByLabel('Cloning repository')).toHaveAttribute('data-status', 'pending');
      unmount();
    }
  });

  it('cloning and pulling both map to Cloning repository as active, with Preparing sandbox marked success', () => {
    const phases: Array<PrepareProgress['phase']> = ['cloning', 'pulling'];
    for (const phase of phases) {
      const { unmount } = renderWithProgress({ phase, message: `msg for ${phase}` });
      expect(stepByLabel('Preparing sandbox')).toHaveAttribute('data-status', 'success');
      expect(stepByLabel('Cloning repository')).toHaveAttribute('data-status', 'running');
      expect(within(stepByLabel('Cloning repository')).getByText(`msg for ${phase}`)).toBeInTheDocument();
      expect(stepByLabel('Starting session')).toHaveAttribute('data-status', 'pending');
      unmount();
    }
  });

  it('finalizing lights up Starting session with earlier groups marked success', () => {
    renderWithProgress({ phase: 'finalizing', message: 'Almost there…' });
    expect(stepByLabel('Preparing sandbox')).toHaveAttribute('data-status', 'success');
    expect(stepByLabel('Cloning repository')).toHaveAttribute('data-status', 'success');
    expect(stepByLabel('Starting session')).toHaveAttribute('data-status', 'running');
    expect(within(stepByLabel('Starting session')).getByText('Almost there…')).toBeInTheDocument();
  });

  it('advances the active group as the observed phase moves across group boundaries', () => {
    const { rerender } = renderWithProgress({ phase: 'provisioning', message: 'Provisioning a new sandbox…' });
    expect(stepByLabel('Preparing sandbox')).toHaveAttribute('data-status', 'running');

    rerender(
      <ChatSessionContext.Provider
        value={{ ...BASE_SESSION, sandboxProgress: { phase: 'cloning', message: 'Cloning octo/hello…' } }}
      >
        <SessionPrepareSteps />
      </ChatSessionContext.Provider>,
    );

    expect(stepByLabel('Preparing sandbox')).toHaveAttribute('data-status', 'success');
    expect(stepByLabel('Cloning repository')).toHaveAttribute('data-status', 'running');
    expect(within(stepByLabel('Cloning repository')).getByText('Cloning octo/hello…')).toBeInTheDocument();
    // The prior phase's secondary text is gone with its step.
    expect(screen.queryByText('Provisioning a new sandbox…')).not.toBeInTheDocument();
  });
});
