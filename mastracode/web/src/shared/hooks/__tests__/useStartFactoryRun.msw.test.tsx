/**
 * The kickoff sequence (`createUserSession → startFactoryRun → navigate`) takes
 * multiple seconds; cards narrate it via `pendingRuns[].phase`. These tests gate
 * each endpoint to pin the phase the hook reports at every step.
 */
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
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

  server.use(
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
      return HttpResponse.json({ session: { sessionId: 'session-1', branch: 'feat/investigate-1' } });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async () => {
      await runGate.promise;
      return HttpResponse.json({
        prepared: {
          workItemId: 'item-1',
          bindingId: 'binding-1',
          threadId: 'thread-1',
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
function renderStartFactoryRun() {
  let latest!: ReturnType<typeof useStartFactoryRun>;
  function Probe() {
    latest = useStartFactoryRun();
    return null;
  }
  const router = createMemoryRouter([{ path: '/factories/:factoryId/*', element: <Probe /> }], {
    initialEntries: [`/factories/${FACTORY_ID}/work`],
  });
  const rendered = renderWithProviders(<RouterProvider router={router} />);
  return { ...rendered, router, current: () => latest };
}

describe('useStartFactoryRun', () => {
  it('advances the pending run phase workspace → kickoff → cleared, then navigates to the thread', async () => {
    const { sessionGate, runGate } = stubKickoffEndpoints();
    const { router, current } = renderStartFactoryRun();

    await waitFor(() => expect(current().enabled).toBe(true));

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

    // Settled: the pending run clears and the router lands on the new thread.
    runGate.resolve();
    await waitFor(() => expect(current().pendingRuns).toHaveLength(0));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/workspaces/session-1/threads/thread-1`),
    );
  });
});
