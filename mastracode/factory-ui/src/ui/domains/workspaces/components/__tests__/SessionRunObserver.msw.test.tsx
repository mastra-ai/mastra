import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import type { SessionActivity, SessionRowsRequest, SessionRowsResponse } from '../../../../../api/types';
import { useSessionRowsQuery } from '../../../../../hooks/useSessionRows';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { saveDoneSound } from '../../../settings/services/doneSound';
import { resetSessionRunObserverForTests, SessionRunObserver } from '../SessionRunObserver';

const FACTORY_ID = 'factory-1';
const SESSION_ID = 'session-1';
const ROWS_REQUEST: SessionRowsRequest = {
  sort: 'activity',
  groupBy: 'none',
  owner: 'all',
  children: false,
  pin: [],
  windows: {},
};
const NO_ROWS: SessionRowsResponse = { total: 0, matching: 0, groups: [], boards: [], owners: [], settling: false };
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

function stubProject(runningSessionIds: () => string[]) {
  const rows = { requests: 0 };
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/session-activity`, () =>
      HttpResponse.json({
        runningSessionIds: runningSessionIds(),
        parkedSessionIds: [],
        initializingSessionIds: [],
        cards: { working: 0, waiting: 0 },
        settling: false,
      } satisfies SessionActivity),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/session-rows`, () => {
      rows.requests += 1;
      return HttpResponse.json(NO_ROWS);
    }),
  );
  return rows;
}

function SidebarWithObserver() {
  useSessionRowsQuery(FACTORY_ID, ROWS_REQUEST);
  return <SessionRunObserver factoryId={FACTORY_ID} />;
}

async function refetchActivity(client: QueryClient) {
  await client.invalidateQueries({ queryKey: queryKeys.sessionActivity(FACTORY_ID) });
  await waitForMutationsIdle(client);
}

beforeEach(() => {
  resetSessionRunObserverForTests();
  oscillatorStart.mockClear();
  saveDoneSound('arcade');
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextStub });
});

describe('SessionRunObserver', () => {
  it("rings and refreshes the sidebar's rows once when a run it watched in flight ends", async () => {
    let running = false;
    const rows = stubProject(() => (running ? [SESSION_ID] : []));
    const { client } = renderWithProviders(<SidebarWithObserver />);
    await waitForMutationsIdle(client);
    expect(rows.requests).toBe(1);

    running = true;
    await refetchActivity(client);
    expect(oscillatorStart).not.toHaveBeenCalled();
    expect(rows.requests).toBe(1);

    running = false;
    await refetchActivity(client);
    expect(oscillatorStart).toHaveBeenCalled();
    expect(rows.requests).toBe(2);

    oscillatorStart.mockClear();
    await refetchActivity(client);
    expect(oscillatorStart).not.toHaveBeenCalled();
    expect(rows.requests).toBe(2);
  });

  it('stays silent for a run already over when the tab opened', async () => {
    stubProject(() => []);
    const { client } = renderWithProviders(<SidebarWithObserver />);
    await waitForMutationsIdle(client);
    await refetchActivity(client);
    expect(oscillatorStart).not.toHaveBeenCalled();
  });

  it('does not ring again for a run it already rang for when the sidebar mounts again', async () => {
    let running = true;
    stubProject(() => (running ? [SESSION_ID] : []));
    const first = renderWithProviders(<SidebarWithObserver />);
    await waitForMutationsIdle(first.client);
    running = false;
    await refetchActivity(first.client);
    expect(oscillatorStart).toHaveBeenCalled();
    oscillatorStart.mockClear();
    first.unmount();

    const second = renderWithProviders(<SidebarWithObserver />);
    await waitForMutationsIdle(second.client);
    expect(oscillatorStart).not.toHaveBeenCalled();
  });
});
