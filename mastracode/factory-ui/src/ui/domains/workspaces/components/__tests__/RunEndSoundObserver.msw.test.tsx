import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { playAttentionSoundOnce } from '../../../factory/services/attentionSound';
import type { FactoryUserSession } from '../../services/user-sessions';
import { resetRunEndSoundForTests, RunEndSoundObserver } from '../RunEndSoundObserver';

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

function stubSessions(rows: () => FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: rows() }),
    ),
  );
}

async function refetchSessions(client: QueryClient) {
  await client.invalidateQueries({ queryKey: queryKeys.sessions(REPOSITORY_ID) });
  await waitForMutationsIdle(client);
}

beforeEach(() => {
  resetRunEndSoundForTests();
  vi.mocked(playAttentionSoundOnce).mockClear();
});

describe('RunEndSoundObserver', () => {
  it('rings once for a run end it watches land, never for the stamp already there at mount', async () => {
    let lastRunEndedAt: string | null = HISTORICAL_END;
    stubSessions(() => [{ ...session, lastRunEndedAt }]);
    const { client } = renderWithProviders(<RunEndSoundObserver projectRepositoryId={REPOSITORY_ID} />);
    await waitForMutationsIdle(client);
    expect(playAttentionSoundOnce).not.toHaveBeenCalled();

    lastRunEndedAt = new Date().toISOString();
    await refetchSessions(client);
    expect(playAttentionSoundOnce).toHaveBeenCalledExactlyOnceWith(`run:${SESSION_ID}`, lastRunEndedAt);

    await refetchSessions(client);
    expect(playAttentionSoundOnce).toHaveBeenCalledTimes(1);
  });

  it('rings the first run of a session that had never run', async () => {
    let lastRunEndedAt: string | null = null;
    stubSessions(() => [{ ...session, lastRunEndedAt }]);
    const { client } = renderWithProviders(<RunEndSoundObserver projectRepositoryId={REPOSITORY_ID} />);
    await waitForMutationsIdle(client);

    lastRunEndedAt = new Date().toISOString();
    await refetchSessions(client);
    expect(playAttentionSoundOnce).toHaveBeenCalledExactlyOnceWith(`run:${SESSION_ID}`, lastRunEndedAt);
  });
});
