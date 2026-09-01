import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { resetRunObserverForTests, useSessionAttentionMarks } from '../../../../../hooks/useWorkspaceAttention';
import { useWorkspacesQuery } from '../../../../../hooks/useWorkspaces';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { playAttentionSoundOnce } from '../../../factory/services/attentionSound';
import { resetSeenForTests } from '../../services/sessionSeen';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspaceAttentionObserver } from '../WorkspaceAttentionObserver';

vi.mock('../../../factory/services/attentionSound', () => ({
  playAttentionSoundOnce: vi.fn().mockResolvedValue(undefined),
}));

const REPOSITORY_ID = 'repository-1';
const SESSION_ID = 'session-1';
const HISTORICAL_END = '2026-08-20T11:00:00.000Z';

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

const scratchSession: FactoryUserSession = {
  ...session,
  id: 'workspace-4',
  sessionId: 'session-scratch',
  title: 'Scratchpad',
  branch: 'user/scratchpad',
};

function stubSessions(rows: () => FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: rows() }),
    ),
  );
}

function MarksProbe() {
  const sessions = useWorkspacesQuery(REPOSITORY_ID);
  const marks = useSessionAttentionMarks([
    ...(sessions.data?.workspaces ?? []),
    ...(sessions.data?.userSessions ?? []),
  ]);
  return <output aria-label="Attention">{Object.keys(marks).join(' ') || 'none'}</output>;
}

function OpenSessionButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(to)}>
      Open session
    </button>
  );
}

/** A stamp later than the observer's baseline, like a run ending after mount. */
function freshRunEnd(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

async function refetchSessions(client: QueryClient) {
  await client.invalidateQueries({ queryKey: queryKeys.sessions(REPOSITORY_ID) });
}

beforeEach(() => {
  localStorage.clear();
  resetSeenForTests();
  resetRunObserverForTests();
  vi.mocked(playAttentionSoundOnce).mockClear();
});

describe('WorkspaceAttentionObserver', () => {
  it('marks a session whose run ends while the viewer watches, and rings once', async () => {
    let lastRunEndedAt: string | null = HISTORICAL_END;
    stubSessions(() => [{ ...session, lastRunEndedAt }]);
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <MarksProbe />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(client);
    expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent('none');

    lastRunEndedAt = freshRunEnd();
    await refetchSessions(client);
    await waitFor(() => expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent(SESSION_ID));
    expect(playAttentionSoundOnce).toHaveBeenCalledExactlyOnceWith(`run:${SESSION_ID}`, lastRunEndedAt);

    // The same stamp arriving again is not a second run end.
    await refetchSessions(client);
    await waitForMutationsIdle(client);
    expect(playAttentionSoundOnce).toHaveBeenCalledTimes(1);
  });

  it('never marks a run that ended before this viewer first saw the list', async () => {
    stubSessions(() => [{ ...session, lastRunEndedAt: HISTORICAL_END }]);
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <MarksProbe />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(client);
    expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent('none');
    expect(playAttentionSoundOnce).not.toHaveBeenCalled();
  });

  it('keeps a mark across a reload, silently', async () => {
    let lastRunEndedAt: string | null = HISTORICAL_END;
    stubSessions(() => [{ ...session, lastRunEndedAt }]);
    const first = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <MarksProbe />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(first.client);
    lastRunEndedAt = freshRunEnd();
    await refetchSessions(first.client);
    await waitFor(() => expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent(SESSION_ID));
    first.unmount();

    // A reload starts a fresh tab: new query cache, no in-memory run history —
    // only localStorage survives.
    resetRunObserverForTests();
    resetSeenForTests();
    vi.mocked(playAttentionSoundOnce).mockClear();
    const second = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <MarksProbe />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(second.client);
    await waitFor(() => expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent(SESSION_ID));
    expect(playAttentionSoundOnce).not.toHaveBeenCalled();
  });

  it('keeps the open session out of attention while its run ends, still ringing', async () => {
    let lastRunEndedAt: string | null = HISTORICAL_END;
    stubSessions(() => [{ ...session, lastRunEndedAt }]);
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={[`/factories/factory-1/workspaces/${SESSION_ID}/threads/${SESSION_ID}`]}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <MarksProbe />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(client);

    lastRunEndedAt = freshRunEnd();
    await refetchSessions(client);
    await waitForMutationsIdle(client);
    expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent('none');
    expect(playAttentionSoundOnce).toHaveBeenCalledExactlyOnceWith(`run:${SESSION_ID}`, lastRunEndedAt);
  });

  it('dismisses a marked user session through its thread route', async () => {
    let lastRunEndedAt: string | null = HISTORICAL_END;
    stubSessions(() => [{ ...scratchSession, lastRunEndedAt }]);
    const user = userEvent.setup();
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <MarksProbe />
        <OpenSessionButton to="/factories/factory-1/user/threads/session-scratch" />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(client);
    lastRunEndedAt = freshRunEnd();
    await refetchSessions(client);
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent('session-scratch'),
    );

    await user.click(screen.getByRole('button', { name: 'Open session' }));

    await waitFor(() => expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent('none'));
  });

  it("clears a mark when another tab absorbs it, through the storage event", async () => {
    let lastRunEndedAt: string | null = HISTORICAL_END;
    stubSessions(() => [{ ...session, lastRunEndedAt }]);
    const { client } = renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/work']}>
        <WorkspaceAttentionObserver projectRepositoryId={REPOSITORY_ID} />
        <MarksProbe />
      </MemoryRouter>,
    );
    await waitForMutationsIdle(client);
    lastRunEndedAt = freshRunEnd();
    await refetchSessions(client);
    await waitFor(() => expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent(SESSION_ID));

    localStorage.setItem('mastracode.sessionSeen.v1', JSON.stringify({ [SESSION_ID]: lastRunEndedAt }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'mastracode.sessionSeen.v1' }));

    await waitFor(() => expect(screen.getByRole('status', { name: 'Attention' })).toHaveTextContent('none'));
  });
});
