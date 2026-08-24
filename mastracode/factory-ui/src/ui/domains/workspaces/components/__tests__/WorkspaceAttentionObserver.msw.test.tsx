import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { useWorkspaceAttentionState } from '../../../../../hooks/useWorkspaceAttention';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import type { FactoryUserSession } from '../../services/github';
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

describe('WorkspaceAttentionObserver', () => {
  it('keeps Ready state across every linked repository', async () => {
    const activity = stubActivity();
    const { client } = renderWithProviders(
      <>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <WorkspaceAttentionObserver projectRepositoryId={SECOND_REPOSITORY_ID} />
        <AttentionProbe />
      </>,
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
      <>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <AttentionProbe />
      </>,
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
});
