import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

function stepByTitle(title: string) {
  const heading = screen.getByRole('heading', { name: title });
  const stepRoot = heading.closest<HTMLElement>('[data-testid="session-prepare-step"]');
  if (!stepRoot) throw new Error(`Could not find step root for title ${title}`);
  return stepRoot;
}

describe('SessionPrepareSteps', () => {
  it('renders exactly two user-facing groups in the canonical order', () => {
    renderSteps({});
    expect(screen.getByRole('status', { name: 'Preparing session' })).toBeInTheDocument();

    const stepRoots = screen.getAllByTestId('session-prepare-step');
    expect(stepRoots).toHaveLength(2);
    expect(within(stepRoots[0]).getByRole('heading', { name: 'Preparing session' })).toBeInTheDocument();
    expect(within(stepRoots[1]).getByRole('heading', { name: 'Starting session' })).toBeInTheDocument();
  });

  it('while session metadata resolves, Preparing session runs with the Starting… fallback message', () => {
    renderSteps({});
    expect(stepByTitle('Preparing session')).toHaveAttribute('data-status', 'running');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'pending');
    expect(within(stepByTitle('Preparing session')).getByText('Starting…')).toBeInTheDocument();
  });

  it('lets message loading light up Starting session once session metadata has resolved', () => {
    renderSteps({ sandboxPreparing: false }, { loadingMessages: true });

    expect(stepByTitle('Preparing session')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Starting session')).getByText('Loading messages…')).toBeInTheDocument();
  });

  it('keeps Starting session active while loaded history merges into the transcript', () => {
    renderSteps({ sandboxPreparing: false }, { historyInitializing: true });

    expect(stepByTitle('Preparing session')).toHaveAttribute('data-status', 'success');
    expect(stepByTitle('Starting session')).toHaveAttribute('data-status', 'running');
    expect(within(stepByTitle('Starting session')).getByText('Starting…')).toBeInTheDocument();
  });

  it('marks every step complete while the preparation loader exits', () => {
    renderSteps({ sandboxPreparing: false }, { finishing: true });

    for (const step of screen.getAllByTestId('session-prepare-step')) {
      expect(step).toHaveAttribute('data-status', 'success');
    }
  });
});
