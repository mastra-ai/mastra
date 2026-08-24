import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PrepareProgress } from '../../../workspaces/services/github';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { ChatThreadMessagesContext } from '../../context/ChatThreadMessagesContext';
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

function renderSteps(
  session: Partial<ChatSessionContextApi>,
  options?: { finishing?: boolean; historyInitializing?: boolean; loadingMessages?: boolean },
) {
  const steps = options?.loadingMessages ? (
    <ChatThreadMessagesContext.Provider value={{ threadId: 'thread-1', isPending: true, error: undefined }}>
      <SessionPrepareSteps finishing={options.finishing} historyInitializing={options.historyInitializing} />
    </ChatThreadMessagesContext.Provider>
  ) : (
    <SessionPrepareSteps finishing={options?.finishing} historyInitializing={options?.historyInitializing} />
  );
  return render(
    <ChatSessionContext.Provider value={{ ...BASE_SESSION, ...session }}>{steps}</ChatSessionContext.Provider>,
  );
}

function renderWithProgress(sandboxProgress: PrepareProgress | undefined) {
  return renderSteps({ sandboxProgress });
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
    expect(screen.getAllByRole('status')).toHaveLength(1);
    const stepRoots = screen.getAllByTestId('session-prepare-step');
    expect(stepRoots).toHaveLength(3);
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
    expect(screen.queryByText('Cloning octo/hello…')).not.toBeInTheDocument();
    expect(screen.queryByText('Provisioning a new sandbox…')).not.toBeInTheDocument();
  });

  it('does not skip ahead to Starting session while the warm-up is still provisioning the sandbox', () => {
    // Messages load in parallel with /ensure, so a pending messages fetch must
    // not check off sandbox steps that have not actually happened.
    renderSteps(
      {
        sandboxPreparing: false,
        sandboxWarming: true,
        sandboxProgress: { phase: 'provisioning', message: 'Provisioning a new sandbox…' },
      },
      { loadingMessages: true },
    );
    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Preparing sandbox')).getByText('Provisioning…')).toBeInTheDocument();
    expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'pending');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'pending');
  });

  it('pins Preparing sandbox while the warm-up is in flight but has not emitted an event yet', () => {
    renderSteps(
      { sandboxPreparing: false, sandboxWarming: true, sandboxProgress: undefined },
      { loadingMessages: true },
    );
    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'running');
    expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'pending');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'pending');
  });

  it('lets message loading light up Starting session once no warm-up is running', () => {
    renderSteps(
      { sandboxPreparing: false, sandboxWarming: false, sandboxProgress: undefined },
      { loadingMessages: true },
    );
    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Starting session')).getByText('Loading messages…')).toBeInTheDocument();
  });

  it('keeps Starting session active while loaded history merges into the transcript', () => {
    renderSteps(
      { sandboxPreparing: false, sandboxWarming: false, sandboxProgress: undefined },
      { historyInitializing: true },
    );
    expect(stepByTitle('Preparing sandbox')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Cloning repository')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Starting session')).getByText('Starting…')).toBeInTheDocument();
  });

  it('marks every step complete while the preparation loader exits', () => {
    renderSteps({ sandboxPreparing: false, sandboxWarming: false, sandboxProgress: undefined }, { finishing: true });

    for (const step of screen.getAllByTestId('session-prepare-step')) {
      expect(step).toHaveAttribute('data-status', 'success');
    }
  });

  it('shows Loading messages… on the done phase since done carries no sandbox work', () => {
    renderSteps(
      { sandboxPreparing: false, sandboxWarming: true, sandboxProgress: { phase: 'done', message: 'Ready' } },
      { loadingMessages: true },
    );
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Starting session')).getByText('Loading messages…')).toBeInTheDocument();
  });
});
