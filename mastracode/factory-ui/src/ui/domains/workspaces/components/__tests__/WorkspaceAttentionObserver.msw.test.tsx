import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { useWorkspaceAttentionState } from '../../../../../hooks/useWorkspaceAttention';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspaceAttentionObserver } from '../WorkspaceAttentionObserver';

const REPOSITORY_ID = 'repository-1';
const SESSION_ID = 'session-1';
const SECOND_REPOSITORY_ID = 'repository-2';
const SECOND_SESSION_ID = 'session-2';

const session: FactoryUserSession = {
  id: 'workspace-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPOSITORY_ID,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org',
  title: 'Implement loader',
  branch: 'factory/issue-24',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: '2026-08-20T10:00:00.000Z',
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
};

const secondSession: FactoryUserSession = {
  ...session,
  id: 'workspace-2',
  sessionId: SECOND_SESSION_ID,
  projectRepositoryId: SECOND_REPOSITORY_ID,
  title: 'Review loader',
  branch: 'factory/pr-24',
};

const siblingSession: FactoryUserSession = {
  ...session,
  id: 'workspace-3',
  sessionId: 'session-sibling',
  title: 'Review the loader fix',
  branch: 'factory/pr-31',
};

const scratchSession: FactoryUserSession = {
  ...session,
  id: 'workspace-4',
  sessionId: 'session-scratch',
  title: 'Scratchpad',
  branch: 'user/scratchpad',
};

function AttentionProbe() {
  const first = useWorkspaceAttentionState({ projectRepositoryId: REPOSITORY_ID, sessionKind: 'factory' });
  const second = useWorkspaceAttentionState({ projectRepositoryId: SECOND_REPOSITORY_ID, sessionKind: 'factory' });
  return (
    <>
      <output aria-label="Ready sessions one">{Object.keys(first.attentionByPath).length}</output>
      <output aria-label="Ready sessions two">{Object.keys(second.attentionByPath).length}</output>
    </>
  );
}

function AttentionKeysProbe() {
  const factory = useWorkspaceAttentionState({ projectRepositoryId: REPOSITORY_ID, sessionKind: 'factory' });
  const user = useWorkspaceAttentionState({ projectRepositoryId: REPOSITORY_ID, sessionKind: 'user' });
  return (
    <>
      <output aria-label="Factory attention">{Object.keys(factory.attentionByPath).join(' ') || 'none'}</output>
      <output aria-label="User attention">{Object.keys(user.attentionByPath).join(' ') || 'none'}</output>
    </>
  );
}

function OpenSessionButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(to)}>
      Open session
    </button>
  );
}

function stubActivity() {
  let running = true;
  let sessionsFail = false;
  let activityRequests = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/sessions`, ({ params }) => {
      if (sessionsFail) return HttpResponse.json({ error: 'unavailable' }, { status: 503 });
      return HttpResponse.json({
        sessions: params.projectRepositoryId === SECOND_REPOSITORY_ID ? [secondSession] : [session],
      });
    }),
    http.get(`${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/active-runs`, () => {
      activityRequests += 1;
      return HttpResponse.json({
        runs: running
          ? [
              { runId: 'run-1', resourceId: SESSION_ID, threadId: SESSION_ID },
              { runId: 'run-2', resourceId: SECOND_SESSION_ID, threadId: SECOND_SESSION_ID },
            ]
          : [],
      });
    }),
  );
  return {
    finishRuns: () => {
      running = false;
    },
    failSessions: () => {
      sessionsFail = true;
    },
    activityRequests: () => activityRequests,
  };
}

function stubRepositoryActivity(initiallyRunning: string[]) {
  const running = new Set(initiallyRunning);
  let sessionsRequests = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, () => {
      sessionsRequests += 1;
      return HttpResponse.json({ sessions: [session, siblingSession, scratchSession] });
    }),
    http.get(`${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/active-runs`, () =>
      HttpResponse.json({
        runs: [...running].map(sessionId => ({
          runId: `run-${sessionId}`,
          resourceId: sessionId,
          threadId: sessionId,
        })),
      }),
    ),
  );
  return {
    finishRun: (sessionId: string) => {
      running.delete(sessionId);
    },
    sessionsRequests: () => sessionsRequests,
  };
}

describe('WorkspaceAttentionObserver', () => {
  it('keeps Ready state across every linked repository', async () => {
    const activity = stubActivity();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <WorkspaceAttentionObserver projectRepositoryId={SECOND_REPOSITORY_ID} />
        <AttentionProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(activity.activityRequests()).toBeGreaterThan(0));
    await waitForMutationsIdle(client);
    expect(screen.getByRole('status', { name: 'Ready sessions one' })).toHaveTextContent('0');
    expect(screen.getByRole('status', { name: 'Ready sessions two' })).toHaveTextContent('0');

    activity.finishRuns();
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL),
    });

    await waitForMutationsIdle(client);
    expect(screen.getByRole('status', { name: 'Ready sessions one' })).toHaveTextContent('1');
    expect(screen.getByRole('status', { name: 'Ready sessions two' })).toHaveTextContent('1');
  });

  it('does not derive Ready state from activity when session loading fails', async () => {
    const activity = stubActivity();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <AttentionProbe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(activity.activityRequests()).toBeGreaterThan(0));
    await waitForMutationsIdle(client);

    activity.failSessions();
    await client.invalidateQueries({ queryKey: queryKeys.sessions(REPOSITORY_ID) });
    await waitForMutationsIdle(client);
    activity.finishRuns();
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL),
    });
    await waitForMutationsIdle(client);

    expect(screen.getByRole('status', { name: 'Ready sessions one' })).toHaveTextContent('0');
  });

  it('keeps the open session out of attention while still refreshing when its run finishes', async () => {
    const activity = stubRepositoryActivity([SESSION_ID, 'session-sibling']);
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/factory-1/workspaces/${SESSION_ID}/threads/${SESSION_ID}`]}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <AttentionKeysProbe />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(client);
    expect(screen.getByRole('status', { name: 'Factory attention' })).toHaveTextContent('none');
    const sessionsRequestsBefore = activity.sessionsRequests();

    activity.finishRun(SESSION_ID);
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL),
    });
    await waitForMutationsIdle(client);

    expect(screen.getByRole('status', { name: 'Factory attention' })).toHaveTextContent('none');
    expect(activity.sessionsRequests()).toBeGreaterThan(sessionsRequestsBefore);

    activity.finishRun('session-sibling');
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL),
    });
    await waitForMutationsIdle(client);

    expect(screen.getByRole('status', { name: 'Factory attention' })).toHaveTextContent('session-sibling');
  });

  it('dismisses a marked session through whichever door opens its thread', async () => {
    const activity = stubRepositoryActivity([SESSION_ID]);
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <AttentionKeysProbe />
        <OpenSessionButton to={`/factories/factory-1/workspaces/${SESSION_ID}`} />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(client);
    activity.finishRun(SESSION_ID);
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL),
    });
    await waitForMutationsIdle(client);
    expect(screen.getByRole('status', { name: 'Factory attention' })).toHaveTextContent(SESSION_ID);

    await user.click(screen.getByRole('button', { name: 'Open session' }));

    await waitFor(() => expect(screen.getByRole('status', { name: 'Factory attention' })).toHaveTextContent('none'));
  });

  it('dismisses a marked user session on its thread route', async () => {
    const activity = stubRepositoryActivity(['session-scratch']);
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <AttentionKeysProbe />
        <OpenSessionButton to="/factories/factory-1/user/threads/session-scratch" />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(client);
    activity.finishRun('session-scratch');
    await client.invalidateQueries({
      queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL),
    });
    await waitForMutationsIdle(client);
    expect(screen.getByRole('status', { name: 'User attention' })).toHaveTextContent('session-scratch');

    await user.click(screen.getByRole('button', { name: 'Open session' }));

    await waitFor(() => expect(screen.getByRole('status', { name: 'User attention' })).toHaveTextContent('none'));
  });
});
