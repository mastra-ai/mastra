/**
 * The kickoff sequence (`createUserSession → startFactoryRun`) takes multiple
 * seconds; cards narrate it via `pendingRuns[].phase`. These tests gate each
 * endpoint to pin the phase the hook reports at every step, and to pin that the
 * run lands as a toast rather than yanking the board to the new thread.
 */
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { useWorkspacesQuery } from '../useWorkspaces';
import { useStartFactoryRun } from '../useStartFactoryRun';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function stubKickoffEndpoints() {
  const sessionGate = deferred();
  const runGate = deferred();
  // The workspace list the sidebar renders from. The kickoff POST appends to it,
  // so a re-read only sees the new row if the hook invalidated the sessions key.
  const sessions: Array<{ sessionId: string; branch: string; updatedAt: string }> = [];

  server.use(
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, async () => {
      await sessionGate.promise;
      const session = { sessionId: 'session-1', branch: 'feat/investigate-1', updatedAt: '2026-01-01T00:00:00.000Z' };
      sessions.push(session);
      return HttpResponse.json({ session });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      // Thread ids track the role so a test that starts two cards at once can
      // tell the two toasts apart.
      const body = (await request.json()) as { workItem: { role: string } };
      await runGate.promise;
      return HttpResponse.json({
        prepared: {
          workItemId: 'item-1',
          bindingId: 'binding-1',
          threadId: `thread-${body.workItem.role}`,
          resourceId: 'resource-1',
          sessionId: 'session-1',
          branch: 'feat/investigate-1',
          revision: 2,
          kickoffStatus: 'sent',
          replayed: false,
        },
      });
    }),
  );

  return { sessionGate, runGate };
}

/** The hook reads `:factoryId` and navigates, so it renders inside a real router. */
function renderStartFactoryRun(client?: QueryClient) {
  // The sidebar's workspace list is mounted alongside the hook, so the test sees
  // exactly what a user staring at the sidebar during kickoff would see. The
  // Toaster rides along because the toast is the only way into a started run.
  let latest!: ReturnType<typeof useStartFactoryRun> & { workspaces: ReturnType<typeof useWorkspacesQuery> };
  function Probe() {
    latest = { ...useStartFactoryRun(), workspaces: useWorkspacesQuery(REPO_ID) };
    return <Toaster position="bottom-right" />;
  }
  const router = createMemoryRouter([{ path: '/factories/:factoryId/*', element: <Probe /> }], {
    initialEntries: [`/factories/${FACTORY_ID}/work`],
  });
  const rendered = renderWithProviders(<RouterProvider router={router} />, client);
  return { ...rendered, router, current: () => latest };
}

function startRun(current: () => ReturnType<typeof useStartFactoryRun>, role: string) {
  act(() => {
    current().start.mutate({
      branch: 'feat/investigate-1',
      threadTitle: `Investigate #1 (${role})`,
      workItem: {
        id: 'item-1',
        role,
        stages: ['triage'],
        source: 'github-issue',
        sourceKey: 'github-issue:1',
        title: 'Investigate #1',
      },
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useStartFactoryRun', () => {
  it('advances the pending run phase workspace → kickoff → cleared, then offers the thread from a toast', async () => {
    const { sessionGate, runGate } = stubKickoffEndpoints();
    const { router, current, client } = renderStartFactoryRun();

    await waitFor(() => expect(current().enabled).toBe(true));

    startRun(current, 'investigator');

    // Phase 1: waiting on the workspace session.
    await waitFor(() => expect(current().pendingRuns).toHaveLength(1));
    expect(current().pendingRuns[0]).toMatchObject({
      id: 'item-1',
      sourceKey: 'github-issue:1',
      role: 'investigator',
      phase: 'workspace',
    });

    // Phase 2: session ready, waiting on the server-side kickoff.
    sessionGate.resolve();
    await waitFor(() => expect(current().pendingRuns[0]?.phase).toBe('kickoff'));

    // Settled: the pending run clears and the board stays exactly where it was.
    runGate.resolve();
    await waitForMutationsIdle(client);
    expect(current().pendingRuns).toHaveLength(0);
    await screen.findByText('Investigate #1 (investigator) is ready');
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`);

    // The toast is the way in.
    await userEvent.click(await screen.findByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/factories/${FACTORY_ID}/workspaces/session-1/threads/thread-investigator`,
      ),
    );
  });

  it('opens a ready session in a new browser tab without leaving the board', async () => {
    const { sessionGate, runGate } = stubKickoffEndpoints();
    const { router, current, client } = renderStartFactoryRun();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    await waitFor(() => expect(current().enabled).toBe(true));
    startRun(current, 'reviewer');
    sessionGate.resolve();
    runGate.resolve();
    await waitForMutationsIdle(client);

    await userEvent.click(await screen.findByRole('button', { name: 'New Tab' }));

    expect(open).toHaveBeenCalledWith(
      `/factories/${FACTORY_ID}/workspaces/session-1/threads/thread-reviewer`,
      '_blank',
      'noopener,noreferrer',
    );
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`);
  });

  it('keeps the board available so several runs can be started back to back', async () => {
    const { sessionGate, runGate } = stubKickoffEndpoints();
    const { router, current, client } = renderStartFactoryRun();

    await waitFor(() => expect(current().enabled).toBe(true));

    startRun(current, 'investigator');
    startRun(current, 'reviewer');

    // Both runs are in flight at once — the first one never navigated away.
    await waitFor(() => expect(current().pendingRuns).toHaveLength(2));
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`);

    sessionGate.resolve();
    runGate.resolve();

    await waitForMutationsIdle(client);
    expect(current().pendingRuns).toHaveLength(0);
    await screen.findByText('Investigate #1 (investigator) is ready');
    await screen.findByText('Investigate #1 (reviewer) is ready');
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`);
  });

  it('refreshes the sidebar workspace list as soon as the kickoff creates its session', async () => {
    const { sessionGate, runGate } = stubKickoffEndpoints();
    // Mirror the app's staleTime: without an explicit invalidation the sidebar
    // would serve the pre-kickoff list from cache instead of refetching.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } },
    });
    const { current } = renderStartFactoryRun(client);

    await waitFor(() => expect(current().enabled).toBe(true));
    // Prime the cache the way the mounted sidebar does, before any session exists.
    await waitFor(() => expect(current().workspaces.data?.workspaces).toEqual([]));

    act(() => {
      current().start.mutate({
        branch: 'feat/investigate-1',
        threadTitle: 'Investigate #1',
        workItem: {
          id: 'item-1',
          role: 'investigator',
          stages: ['triage'],
          source: 'github-issue',
          sourceKey: 'github-issue:1',
          title: 'Investigate #1',
        },
      });
    });

    sessionGate.resolve();
    runGate.resolve();

    await waitForMutationsIdle(client);
    expect(current().workspaces.data?.workspaces).toEqual([
      expect.objectContaining({ sessionId: 'session-1', branch: 'feat/investigate-1' }),
    ]);
  });
});
