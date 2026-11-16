/**
 * BDD coverage for whether anything files new cards onto a board. The board shows cards only: the
 * server files new issues and pull requests of every connected source, so no provider's list is read.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, onTestFinished } from 'vitest';

import { builtinBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import type { InstalledBoardInfo } from '../../../../../api/types';
import type { IntakeSourceBinding } from '../../services/intake';
import { useBoardIntakeSetup } from '../useBoardIntakeSetup';
import { githubWithLinearConfig, gitlabOnlyConfig, connectedLinear, disabledGitlab } from './fixtures/query-loading';

const repository: LinkedRepositoryPayload = { projectRepositoryId: 'repo-1', slug: 'acme/app' };
const workBoard = builtinBoardCatalog.boards.find(board => board.id === 'work')!;

const renderSetup = (factoryProjectId: string, definition: InstalledBoardInfo = workBoard) =>
  renderHookWithProviders(() => useBoardIntakeSetup({ factoryProjectId, repositories: [repository], definition }));

/** Records every request for a provider's list of issues or pull requests. */
function recordProviderLists() {
  const asked: string[] = [];
  const record = ({ request }: { request: Request }) => {
    const { pathname } = new URL(request.url);
    const listsIssues = /^\/web\/(github|gitlab)\/projects\/[^/]+\/(issues|prs)$/.test(pathname);
    if (listsIssues || /^\/web\/(gitlab|linear|jira|incidentio)\/issues$/.test(pathname)) asked.push(pathname);
  };
  server.events.on('request:start', record);
  onTestFinished(() => {
    server.events.removeListener('request:start', record);
  });
  return asked;
}

describe('useBoardIntakeSetup with sources the server files from', () => {
  const bindings: IntakeSourceBinding[] = [
    { integrationId: 'linear', sourceId: 'proj-1', factoryProjectId: 'factory-1' },
    { integrationId: 'jira', sourceId: '10001', factoryProjectId: 'factory-1' },
    { integrationId: 'incidentio', sourceId: 'incidentio:follow-ups', factoryProjectId: 'factory-1' },
  ];

  /** Linear, Jira and incident.io connected, selected and bound to the viewed Factory. */
  function stubFiledSources() {
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: false, sourceIds: null },
            linear: { enabled: true, sourceIds: ['proj-1'] },
            jira: { enabled: true, sourceIds: ['10001'] },
            incidentio: { enabled: true, sourceIds: ['incidentio:follow-ups'] },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, workspace: { name: 'Acme', urlKey: 'acme' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/jira/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: true,
          mode: 'platform',
          site: null,
          sites: [],
          reason: 'ready',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, mode: 'platform', reason: 'ready' }),
      ),
    );
  }

  it('counts the board as fed by them and asks none of them for a list', async () => {
    stubFiledSources();
    const asked = recordProviderLists();

    const { result, client } = renderSetup('factory-1');

    await waitFor(() => expect(result.current.isPending).toBe(false));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fed).toBe(true);
    expect(asked).toEqual([]);
  });

  it('keeps the board pending until the bindings of a connected source have loaded', async () => {
    stubFiledSources();
    let releaseBindings: () => void = () => {};
    const bindingsRequested = new Promise<void>(resolve => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/intake/bindings`, async () => {
          resolve();
          await new Promise<void>(release => (releaseBindings = release));
          return HttpResponse.json({ bindings });
        }),
      );
    });

    const { result } = renderSetup('factory-1');

    await bindingsRequested;
    expect(result.current.isPending).toBe(true);

    releaseBindings();
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('reports bindings that failed to load, and clears the failure once a retry loads them', async () => {
    stubFiledSources();
    let failing = true;
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () =>
        failing
          ? HttpResponse.json({ error: 'bindings unavailable' }, { status: 500 })
          : HttpResponse.json({ bindings }),
      ),
    );

    const { result } = renderSetup('factory-1');

    await waitFor(() => expect(result.current.failure).toBeDefined(), { timeout: 5000 });
    failing = false;
    result.current.failure!.retry();
    await waitFor(() => expect(result.current.failure).toBeUndefined());
    expect(result.current.fed).toBe(true);
  });
});

describe('useBoardIntakeSetup query loading', () => {
  it('keeps the board pending until every configured source is discovered', async () => {
    let release = () => {};
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    let statusRequested = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config: githubWithLinearConfig })),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
      http.get(`${TEST_BASE_URL}/web/linear/status`, async () => {
        statusRequested = true;
        await held;
        return HttpResponse.json(connectedLinear);
      }),
    );
    const { result, unmount } = renderSetup('factory-1');
    try {
      await waitFor(() => expect(statusRequested).toBe(true));
      expect(result.current.isPending).toBe(true);
      release();
      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(result.current.fed).toBe(true);
    } finally {
      release();
      unmount();
    }
  });

  it('starts GitLab status before configuration resolves', async () => {
    let release = () => {};
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    let requested = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/config`, async () => {
        await held;
        return HttpResponse.json({ config: gitlabOnlyConfig });
      }),
      http.get(`${TEST_BASE_URL}/web/gitlab/status`, () => {
        requested = true;
        return HttpResponse.json(disabledGitlab);
      }),
    );
    const { unmount } = renderSetup('factory-1');
    try {
      await waitFor(() => expect(requested).toBe(true));
    } finally {
      release();
      unmount();
    }
  });
});
