import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { createUserSession } from '../../../workspaces/services/user-sessions';
import type { FactoryUserSession } from '../../../workspaces/services/user-sessions';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';

const CHANGES_URL = `${TEST_BASE_URL}/web/workspace/changes`;
const SESSION_ID = 'session-public-1';
const SESSION_URL = `${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`;
const RECREATE_URL = `${SESSION_URL}/sandbox/recreate`;
const FACTORY_ID = 'factory-1';
const WORKSPACE = 'session-1';

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });

function sessionPayload(capabilities?: FactoryUserSession['capabilities']) {
  return {
    id: 'row-1',
    sessionId: SESSION_ID,
    projectRepositoryId: 'link-1',
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    title: 'Fix the build',
    branch: `user/session-${SESSION_ID}`,
    baseBranch: 'main',
    sandboxId: 'vm-old',
    sandboxWorkdir: '/home/user/repo',
    materializedAt: '2026-10-15T00:00:00.000Z',
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...(capabilities ? { capabilities } : {}),
  };
}

const twoChanges = {
  workspacePath: WORKSPACE,
  available: true,
  additions: 5,
  deletions: 2,
  changes: [
    { path: 'src/agent.ts', status: 'modified', additions: 4, deletions: 1 },
    { path: 'README.md', status: 'modified', additions: 1, deletions: 1 },
  ],
};

function installHandlers({
  capabilities,
  changes = () => HttpResponse.json(twoChanges),
  recreate = () => HttpResponse.json({ recreated: true, aborted: false }),
}: {
  capabilities?: FactoryUserSession['capabilities'];
  changes?: () => Response;
  recreate?: () => Response;
} = {}) {
  const counts = { changes: 0, session: 0, recreate: 0 };
  server.use(
    http.get(CHANGES_URL, () => {
      counts.changes += 1;
      return changes();
    }),
    http.get(SESSION_URL, () => {
      counts.session += 1;
      return HttpResponse.json({ session: sessionPayload(capabilities) });
    }),
    http.post(RECREATE_URL, () => {
      counts.recreate += 1;
      return recreate();
    }),
  );
  return counts;
}

function renderPanel(sessionId: string | null = SESSION_ID, client?: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <>
      <WorkspaceViewerPanel
        workspacePath={WORKSPACE}
        factoryProjectId={FACTORY_ID}
        sessionId={sessionId ?? undefined}
      />
      <Toaster position="bottom-right" />
    </>,
    client,
  );
}

async function openDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /Recreate sandbox/ }));
  return { user, dialog: await screen.findByRole('alertdialog') };
}

describe('Recreate sandbox in the workspace panel', () => {
  it.each([
    ['has no capabilities', undefined],
    ['is not allowed to recreate', { recreateSandbox: false }],
  ])('hides the action when the session %s', async (_label, capabilities) => {
    const counts = installHandlers({ capabilities });
    const { client } = renderPanel();

    await screen.findByRole('button', { name: /Changes/ });
    await waitForMutationsIdle(client);
    expect(counts.session).toBe(1);
    expect(screen.queryByRole('button', { name: /Recreate sandbox/ })).toBeNull();
  });

  it('hides the action when the panel has no session', async () => {
    const counts = installHandlers({ capabilities: { recreateSandbox: true } });
    const { client } = renderPanel(null);

    await screen.findByRole('button', { name: /Changes/ });
    await waitForMutationsIdle(client);
    expect(counts.session).toBe(0);
    expect(screen.queryByRole('button', { name: /Recreate sandbox/ })).toBeNull();
  });

  it('warns how many uncommitted changes will be lost and that a running agent stops', async () => {
    installHandlers({ capabilities: { recreateSandbox: true } });
    renderPanel();
    await screen.findByText('+5');

    const { dialog } = await openDialog();

    expect(within(dialog).getByRole('heading', { name: 'Recreate sandbox?' })).toBeInTheDocument();
    expect(within(dialog).getByText('2 uncommitted changes will be lost.')).toBeInTheDocument();
    expect(within(dialog).getByText('A running agent will be stopped.')).toBeInTheDocument();
  });

  it.each([
    ['fails', () => HttpResponse.json({ error: 'sandbox unreachable' }, { status: 500 })],
    [
      'reports no sandbox',
      () => HttpResponse.json({ workspacePath: WORKSPACE, available: false, additions: 0, deletions: 0, changes: [] }),
    ],
  ])('warns that changes could not be checked when the changes query %s', async (_label, changes) => {
    installHandlers({ capabilities: { recreateSandbox: true }, changes });
    const { client } = renderPanel();
    await screen.findByRole('button', { name: /Recreate sandbox/ });
    await waitForMutationsIdle(client);

    const { dialog } = await openDialog();

    expect(within(dialog).getByText("Uncommitted changes couldn't be checked and will be lost.")).toBeInTheDocument();
  });

  it('recreates, refetches the workspace and session, and confirms with a toast', async () => {
    const counts = installHandlers({ capabilities: { recreateSandbox: true } });
    const { client } = renderPanel();
    client.setQueryData(queryKeys.sessions(FACTORY_ID), { sessions: [] });
    // Listings and file contents from other threads of the same workspace.
    client.setQueryData(queryKeys.workspaceTree(WORKSPACE, 'src'), { entries: [] });
    client.setQueryData(queryKeys.workspaceFile(WORKSPACE, 'old.ts'), { path: 'old.ts' });
    await screen.findByText('+5');
    await waitForMutationsIdle(client);
    const before = { ...counts };

    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Recreate' }));
    await waitForMutationsIdle(client);

    expect(counts.recreate).toBe(1);
    expect(counts.changes).toBeGreaterThan(before.changes);
    expect(counts.session).toBeGreaterThan(before.session);
    expect(client.getQueryState(queryKeys.sessions(FACTORY_ID))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.workspaceTree(WORKSPACE, 'src'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.workspaceFile(WORKSPACE, 'old.ts'))?.isInvalidated).toBe(true);
    expect(await screen.findByText('Sandbox recreated. Send a message to continue.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('keeps the dialog open and shows the server error when recreate fails', async () => {
    const counts = installHandlers({
      capabilities: { recreateSandbox: true },
      recreate: () => HttpResponse.json({ error: 'Platform proxy unavailable' }, { status: 500 }),
    });
    const { client } = renderPanel();

    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Recreate' }));
    await waitForMutationsIdle(client);

    expect(counts.recreate).toBe(1);
    expect(within(screen.getByRole('alertdialog')).getByRole('alert')).toHaveTextContent('Platform proxy unavailable');
  });

  it('shows the action for a session seeded from its create response before any session fetch', async () => {
    let sessionFetches = 0;
    server.use(
      http.post(`${TEST_BASE_URL}/web/source-control/projects/link-1/sessions`, () =>
        HttpResponse.json({ session: sessionPayload({ recreateSandbox: true }) }),
      ),
      http.get(CHANGES_URL, () => HttpResponse.json(twoChanges)),
      // The refetch never answers, so the row can only come from the seeded create response.
      http.get(SESSION_URL, () => {
        sessionFetches += 1;
        return new Promise<Response>(() => {});
      }),
    );
    const created = await createUserSession(TEST_BASE_URL, 'link-1', { sessionId: SESSION_ID, title: 'Fix the build' });
    const { client } = renderWithProviders(<></>);
    client.setQueryData(queryKeys.userSession(created.sessionId), created);

    renderPanel(SESSION_ID, client);

    expect(await screen.findByRole('button', { name: /Recreate sandbox/ })).toBeInTheDocument();
    expect(sessionFetches).toBeLessThanOrEqual(1);
  });
});
