/**
 * Focused coverage of the `<SessionPrepareSteps>` loader: renders three
 * user-facing groups ("Preparing sandbox" → "Cloning repository" →
 * "Starting session") built on the DS `ProcessStepListItem` primitive,
 * marks each pending / running / success based on `sandboxProgress.phase`.
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

function stepByTitle(title: string) {
  const heading = screen.getByRole('heading', { name: title });
  const stepRoot = heading.closest<HTMLElement>('[data-testid="session-prepare-step"]');
  if (!stepRoot) throw new Error(`Could not find step root for title ${title}`);
  return stepRoot;
}

describe('SessionPrepareSteps', () => {
  it('renders exactly three user-facing groups in the canonical order', () => {
    renderWithProgress(undefined);
    expect(screen.getByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    const stepRoots = screen.getAllByTestId('session-prepare-step');
    expect(stepRoots).toHaveLength(3);
    // Each ProcessStepListItem auto-formats the id: preparing-sandbox → "Preparing sandbox"
    expect(within(stepRoots[0]).getByRole('heading', { name: 'Preparing sandbox' })).toBeInTheDocument();
    expect(within(stepRoots[1]).getByRole('heading', { name: 'Cloning repository' })).toBeInTheDocument();
    expect(within(stepRoots[2]).getByRole('heading', { name: 'Starting session' })).toBeInTheDocument();
  });

  it('before any progress arrives, Preparing sandbox is running with the Starting… fallback message', () => {
    renderWithProgress(undefined);
    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'running');
    expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'pending');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'pending');
    expect(within(stepByTitle('Preparing sandbox')).getByText('Starting…')).toBeInTheDocument();
  });

  it('reattaching / provisioning / preparing-workspace all map to Preparing sandbox with short descriptions', () => {
    const phases: Array<[PrepareProgress['phase'], string]> = [
      ['reattaching', 'Reattaching…'],
      ['provisioning', 'Provisioning…'],
      ['preparing-workspace', 'Preparing files…'],
    ];
    for (const [phase, description] of phases) {
      const { unmount } = renderWithProgress({ phase, message: `long server message for ${phase}` });
      expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'running');
      expect(within(stepByTitle('Preparing sandbox')).getByText(description)).toBeInTheDocument();
      expect(screen.queryByText(`long server message for ${phase}`)).not.toBeInTheDocument();
      expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'pending');
      unmount();
    }
  });

  it('cloning and pulling map to Cloning repository with short descriptions', () => {
    const phases: Array<[PrepareProgress['phase'], string]> = [
      ['cloning', 'Cloning…'],
      ['pulling', 'Fetching updates…'],
    ];
    for (const [phase, description] of phases) {
      const { unmount } = renderWithProgress({ phase, message: `long server message for ${phase}` });
      expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'success');
      expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'running');
      expect(within(stepByTitle('Cloning repository')).getByText(description)).toBeInTheDocument();
      expect(screen.queryByText(`long server message for ${phase}`)).not.toBeInTheDocument();
      expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'pending');
      unmount();
    }
  });

  it('finalizing lights up Starting session with earlier groups marked success', () => {
    renderWithProgress({ phase: 'finalizing', message: 'A long server finalization message…' });
    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Starting session')).getByText('Finalizing…')).toBeInTheDocument();
  });

  it('keeps Starting session active when the done event arrives before readiness updates', () => {
    renderWithProgress({ phase: 'done', message: 'Ready' });
    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Starting session')).getByText('Starting…')).toBeInTheDocument();
  });

  it('advances the active group as the observed phase crosses group boundaries', () => {
    const { rerender } = renderWithProgress({ phase: 'provisioning', message: 'Provisioning a new sandbox…' });
    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'running');

    rerender(
      <ChatSessionContext.Provider
        value={{ ...BASE_SESSION, sandboxProgress: { phase: 'cloning', message: 'Cloning octo/hello…' } }}
      >
        <SessionPrepareSteps />
      </ChatSessionContext.Provider>,
    );

    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Cloning repository')).getByText('Cloning…')).toBeInTheDocument();
    // Raw server text never enters the fixed-width description slot.
    expect(screen.queryByText('Cloning octo/hello…')).not.toBeInTheDocument();
    expect(screen.queryByText('Provisioning a new sandbox…')).not.toBeInTheDocument();
  });
});
