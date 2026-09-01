import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import { saveDoneSound } from '../../../settings/services/doneSound';
import type { FactoryUserSession } from '../../services/user-sessions';
import { resetRunEndObserverForTests, RunEndObserver } from '../RunEndObserver';

const REPOSITORY_ID = 'repository-1';
const SESSION_ID = 'session-1';
const oscillatorStart = vi.fn();

class AudioContextStub {
  state = 'running';
  currentTime = 0;
  destination = {};

  resume = vi.fn();

  createOscillator() {
    return { type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: oscillatorStart, stop: vi.fn() };
  }

  createGain() {
    return { gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  }
}

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
  const sessionsList = { requests: 0 };
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, () => {
      sessionsList.requests += 1;
      return HttpResponse.json({ sessions: [session] });
    }),
    http.get(`${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}/active-runs`, () =>
      HttpResponse.json({
        runs: running() ? [{ runId: 'run-1', resourceId: SESSION_ID, threadId: SESSION_ID }] : [],
      }),
    ),
  );
  return sessionsList;
}

async function refetchRegistry(client: QueryClient) {
  await client.invalidateQueries({ queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL) });
  await waitForMutationsIdle(client);
}

beforeEach(() => {
  resetRunEndObserverForTests();
  oscillatorStart.mockClear();
  saveDoneSound('arcade');
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextStub });
});

describe('RunEndObserver', () => {
  it('rings and refetches the sessions list once when a run it watched in flight ends', async () => {
    let running = false;
    const sessionsList = stubRegistry(() => running);
    const { client } = renderWithProviders(<RunEndObserver projectRepositoryId={REPOSITORY_ID} />);
    await waitForMutationsIdle(client);
    expect(sessionsList.requests).toBe(1);

    running = true;
    await refetchRegistry(client);
    expect(oscillatorStart).not.toHaveBeenCalled();
    expect(sessionsList.requests).toBe(1);

    running = false;
    await refetchRegistry(client);
    expect(oscillatorStart).toHaveBeenCalled();
    expect(sessionsList.requests).toBe(2);

    oscillatorStart.mockClear();
    await refetchRegistry(client);
    expect(oscillatorStart).not.toHaveBeenCalled();
    expect(sessionsList.requests).toBe(2);
  });

  it('stays silent for a run already over when the tab opened', async () => {
    stubRegistry(() => false);
    const { client } = renderWithProviders(<RunEndObserver projectRepositoryId={REPOSITORY_ID} />);
    await waitForMutationsIdle(client);
    await refetchRegistry(client);
    expect(oscillatorStart).not.toHaveBeenCalled();
  });
});
