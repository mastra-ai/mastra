import type { AgentControllerEvent } from '@mastra/client-js';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import { GoalPanel } from '../../components/GoalPanel';
import { GoalStatus } from '../../components/StatusLine/GoalStatus';
import { OperationalMemoryStatus } from '../../components/StatusLine/OperationalMemoryStatus';
import { QueuedFollowUps } from '../../components/StatusLine/QueuedFollowUps';
import { Transcript } from '../../components/Transcript';
import { FACTORY_ID, SESSION_ID, stubPreparingSession } from '../../components/__tests__/composer-session-test-fixture';
import type { SessionStateSnapshot } from '../../services/runtime';
import { useChatCommands } from '../ChatCommandsProvider';
import { ChatSessionTestProvider } from '../ChatSessionTestProvider';
import { useChatTranscript } from '../useChatTranscript';

const snapshot: SessionStateSnapshot = {
  tokenUsage: { promptTokens: 21, completionTokens: 34, totalTokens: 55 },
  omProgress: {
    status: 'idle',
    pendingTokens: 320,
    threshold: 1000,
    thresholdPercent: 32,
    observationTokens: 500,
    reflectionThreshold: 2000,
    reflectionThresholdPercent: 25,
    projectedMessageRemoval: 0,
    projectedReflectionSavings: 0,
  },
};

const goalEvent: AgentControllerEvent = {
  type: 'goal_evaluation',
  payload: {
    objective: 'Fix the failing build',
    iteration: 2,
    maxRuns: 5,
    passed: false,
    status: 'active',
    results: [],
    duration: 100,
    timedOut: false,
    maxRunsReached: false,
    suppressFeedback: false,
    shouldContinue: true,
  },
};

function RuntimeSurface({ resetState }: { resetState?: SessionStateSnapshot }) {
  const { reset } = useChatTranscript();
  const { runComposerCommand } = useChatCommands();
  return (
    <>
      <GoalPanel />
      <GoalStatus />
      <OperationalMemoryStatus />
      <QueuedFollowUps />
      <Transcript />
      <button onClick={() => void runComposerCommand('/cost')}>Cost</button>
      <button onClick={() => void runComposerCommand('/om')}>Memory phase</button>
      <button onClick={() => reset('next-thread', resetState)}>Reset thread</button>
    </>
  );
}

function renderRuntime(resetState?: SessionStateSnapshot) {
  const session = stubPreparingSession();
  server.use(
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({ controllerId: 'code', resourceId: params.resourceId, threadId: SESSION_ID, ...snapshot }),
    ),
  );
  renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <MainSidebarProvider storageKey="runtime-test">
              <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
                <OverlaysProvider>
                  <RuntimeSurface resetState={resetState} />
                </OverlaysProvider>
              </ChatSessionTestProvider>
            </MainSidebarProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  session.finishWorkspace();
  return session;
}

describe('chat runtime consumers', () => {
  it('hydrates status from the session and updates the goal panel and commands from live events', async () => {
    const session = renderRuntime();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Memory budgets/ });
    await user.click(screen.getByRole('button', { name: 'Cost' }));
    expect(await screen.findByText('Tokens — prompt: 21, completion: 34, total: 55')).toBeInTheDocument();

    await session.emit({
      type: 'display_state_changed',
      displayState: {
        bufferingObservations: true,
        tokenUsage: { promptTokens: 30, completionTokens: 45, totalTokens: 75 },
      },
    });
    await session.emit(goalEvent);
    await session.emit({ type: 'follow_up_queued', count: 2 });
    await session.emit({ type: 'om_buffering_start' });

    expect(await screen.findByText('Fix the failing build')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByText('pursuing goal')).toBeInTheDocument();
    expect(await screen.findByText('2 queued')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Consolidating observations in the background/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cost' }));
    expect(await screen.findByText('Tokens — prompt: 30, completion: 45, total: 75')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Memory phase' }));
    expect(await screen.findByText('Observational memory phase: buffering')).toBeInTheDocument();
  });

  it.each([false, true])('resets transcript and runtime together, restoring a snapshot: %s', async restoreSnapshot => {
    const session = renderRuntime(restoreSnapshot ? snapshot : undefined);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Memory budgets/ });
    await session.emit(goalEvent);
    await session.emit({ type: 'follow_up_queued', count: 2 });
    await session.emit({ type: 'om_reflection_start' });
    await session.emit({
      type: 'display_state_changed',
      displayState: { ...snapshot, bufferingObservations: true },
    });
    await session.emit({ type: 'info', message: 'Previous thread notice' });
    await screen.findByText('Previous thread notice');
    await user.click(screen.getByRole('button', { name: 'Reset thread' }));

    await waitFor(() => expect(screen.queryByText('Previous thread notice')).not.toBeInTheDocument());
    expect(screen.queryByText('Fix the failing build')).not.toBeInTheDocument();
    expect(screen.queryByText('pursuing goal')).not.toBeInTheDocument();
    expect(screen.queryByText('2 queued')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Consolidating observations in the background/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Memory phase' }));
    expect(await screen.findByText('Observational memory phase: idle')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cost' }));
    expect(
      await screen.findByText(
        restoreSnapshot ? 'Tokens — prompt: 21, completion: 34, total: 55' : 'No token usage recorded yet.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Memory budgets/ }) !== null).toBe(restoreSnapshot);
  });
});
