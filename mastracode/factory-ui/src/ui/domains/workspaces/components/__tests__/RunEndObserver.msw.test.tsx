import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import { playDoneSound } from '../../../settings/services/doneSound';
import type { FactoryUserSession } from '../../services/user-sessions';
import { resetRunEndSoundForTests, RunEndSoundObserver } from '../RunEndSoundObserver';

vi.mock('../../../settings/services/doneSound', () => ({ playDoneSound: vi.fn() }));

const REPOSITORY_ID = 'repository-1';
const SESSION_ID = 'session-1';

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

function stubRegistry(running: () => boolean) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [session] }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/active-runs`, () =>
      HttpResponse.json({
        runs: running() ? [{ runId: 'run-1', resourceId: SESSION_ID, threadId: SESSION_ID }] : [],
      }),
    ),
  );
}

async function refetchRegistry(client: QueryClient) {
  await client.invalidateQueries({ queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL) });
  await waitForMutationsIdle(client);
}

beforeEach(() => {
  resetRunEndSoundForTests();
  vi.mocked(playDoneSound).mockClear();
});

describe('RunEndSoundObserver', () => {
  it('rings once when a run it watched in flight ends, never on mount or on an idle refetch', async () => {
    let running = false;
    stubRegistry(() => running);
    const { client } = renderWithProviders(<RunEndSoundObserver projectRepositoryId={REPOSITORY_ID} />);
    await waitForMutationsIdle(client);

    running = true;
    await refetchRegistry(client);
    expect(playDoneSound).not.toHaveBeenCalled();

    running = false;
    await refetchRegistry(client);
    expect(playDoneSound).toHaveBeenCalledTimes(1);

    await refetchRegistry(client);
    expect(playDoneSound).toHaveBeenCalledTimes(1);
  });

  it('stays silent for a run already over when the tab opened', async () => {
    stubRegistry(() => false);
    const { client } = renderWithProviders(<RunEndSoundObserver projectRepositoryId={REPOSITORY_ID} />);
    await waitForMutationsIdle(client);
    await refetchRegistry(client);
    expect(playDoneSound).not.toHaveBeenCalled();
  });
});
