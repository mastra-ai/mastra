/**
 * BDD coverage for opening a sidebar session row: clicking a row navigates
 * straight to the session's thread without first blocking on an
 * agent-controller session create. The session id doubles as its thread id, so
 * the row needs no round-trip to resolve a navigation target — the thread page
 * brings the session online on mount. No "Opening <name>" spinner is shown and
 * no session-create request is fired from the row.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import { SessionsSection } from '../SessionsSection';
import { testChatSession } from './fixtures/sessionsSection';

const projectRepositoryId = 'ghp-1';
const slackSource = {
  integrationId: 'slack',
  type: 'slack-thread',
  workspaceId: 'T123',
  externalId: 'slack:C123:1791936483.798759',
};
const slackThreadUrl = 'https://app.slack.com/client/T123/C123/thread/C123-1791936483.798759';

const existingSession: FactoryUserSession = {
  id: 'row-1',
  sessionId: 'sess-1',
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org' as const,
  branch: 'user/my-feature',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

/** Stub the factory (with one linked repository) + the session list. */
function stubFactoryWithRepository(sessions: FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-7',
            repositories: [
              {
                id: projectRepositoryId,
                branch: 'main',
                sandboxWorkdir: '/workspace/hello',
                repository: { slug: 'octo/hello', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions })),
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <output data-testid="pathname">{location.pathname}</output>
      <output data-testid="navigation-state">{JSON.stringify(location.state)}</output>
    </>
  );
}

function renderSection(initialEntry = '/factories/fp-1') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
          <Route path="*" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Session row open', () => {
  describe.each(['context', 'dropdown'] as const)('%s menu source links', menu => {
    it.each([
      {
        kind: 'saved permalink',
        source: { ...slackSource, url: 'https://example.slack.com/archives/C123/p1791936483798759' },
        expected: 'https://example.slack.com/archives/C123/p1791936483798759',
      },
      { kind: 'workspace and thread IDs', source: slackSource, expected: slackThreadUrl },
      {
        kind: 'direct message',
        source: { ...slackSource, externalId: 'slack:D123:' },
        expected: 'https://app.slack.com/client/T123/D123',
      },
      { kind: 'missing workspace', source: { ...slackSource, workspaceId: undefined }, expected: undefined },
      {
        kind: 'missing conversation',
        source: { ...slackSource, externalId: 'slack::1791936483.798759' },
        expected: undefined,
      },
      {
        kind: 'different source',
        source: {
          integrationId: 'github',
          type: 'issue',
          externalId: '42',
          url: 'https://github.com/acme/app/issues/42',
        },
        expected: undefined,
      },
    ])('offers the Slack conversation link for a $kind when available', async ({ source, expected }) => {
      const session = { ...existingSession, branch: 'slack/1791936483-798759', title: 'Slack discussion' };
      stubFactoryWithRepository([session]);
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () =>
          HttpResponse.json({
            workItems: [
              {
                id: 'slack-item',
                orgId: session.orgId,
                createdBy: session.userId,
                factoryProjectId: 'fp-1',
                externalSource: source,
                parentWorkItemId: null,
                title: session.title,
                stages: ['intake'],
                stageHistory: [],
                sessions: {
                  work: {
                    sessionId: session.sessionId,
                    branch: session.branch,
                    threadId: session.sessionId,
                    startedBy: session.userId,
                  },
                },
                metadata: {},
                revision: 1,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
              },
            ],
          }),
        ),
      );
      const user = userEvent.setup();
      const { client } = renderSection();
      await screen.findByRole('link', { name: 'Slack discussion' });
      await waitFor(() => expect(client.isFetching()).toBe(0));
      if (menu === 'context') fireEvent.contextMenu(screen.getByRole('link', { name: 'Slack discussion' }));
      else await user.click(screen.getByRole('button', { name: 'Session actions for Slack discussion' }));
      await screen.findByRole('menuitem', { name: 'Open in new tab' });

      if (!expected) {
        expect(screen.queryByRole('menuitem', { name: 'Open in Slack' })).not.toBeInTheDocument();
        return;
      }
      const link = await screen.findByRole('menuitem', { name: 'Open in Slack' });
      expect(link).toHaveAttribute('href', expected);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/factories\/fp-1$/);
    });

    it.each([
      {
        kind: 'GitHub issue and related PR',
        branch: 'factory/issue-42',
        source: {
          integrationId: 'github',
          type: 'issue',
          externalId: '42',
          url: 'https://github.com/acme/app/issues/42',
        },
        related: true,
        expected: [
          ['Open in GitHub', 'https://github.com/acme/app/issues/42'],
          ['Open pull request', 'https://github.com/acme/app/pull/43'],
        ],
      },
      {
        kind: 'Slack user session and related PR',
        branch: 'slack/1791936483-798759',
        source: slackSource,
        related: true,
        expected: [
          ['Open in Slack', slackThreadUrl],
          ['Open pull request', 'https://github.com/acme/app/pull/43'],
        ],
      },
      {
        kind: 'GitHub PR',
        branch: 'factory/pr-43',
        source: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: '43',
          url: 'https://github.com/acme/app/pull/43',
        },
        related: false,
        expected: [['Open pull request', 'https://github.com/acme/app/pull/43']],
      },
      {
        kind: 'GitLab merge request',
        branch: 'factory/pr-43',
        source: {
          integrationId: 'gitlab',
          type: 'pull-request',
          externalId: '43',
          url: 'https://gitlab.com/acme/app/-/merge_requests/43',
        },
        related: false,
        expected: [['Open merge request', 'https://gitlab.com/acme/app/-/merge_requests/43']],
      },
      {
        kind: 'Linear issue',
        branch: 'factory/issue-42',
        source: {
          integrationId: 'linear',
          type: 'issue',
          externalId: 'FACT-528',
          url: 'https://linear.app/acme/issue/FACT-528',
        },
        related: false,
        expected: [['Open in Linear', 'https://linear.app/acme/issue/FACT-528']],
      },
    ])(
      'opens the available source links for a $kind without duplicates',
      async ({ branch, source, related, expected }) => {
        const session = { ...existingSession, branch, title: 'Linked session' };
        stubFactoryWithRepository([session]);
        const item = {
          id: 'source-item',
          factoryProjectId: 'fp-1',
          orgId: session.orgId,
          createdBy: session.userId,
          externalSource: source,
          parentWorkItemId: null,
          title: 'Original work item',
          stages: ['intake'],
          stageHistory: [],
          sessions: {
            work: { sessionId: session.sessionId, branch, threadId: session.sessionId, startedBy: session.userId },
          },
          metadata: {},
          revision: 1,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        };
        const pullRequest = {
          ...item,
          id: 'pull-request',
          parentWorkItemId: item.id,
          sessions: {},
          externalSource: {
            integrationId: 'github',
            type: 'pull-request',
            externalId: '43',
            url: 'https://github.com/acme/app/pull/43',
          },
        };
        server.use(
          http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () =>
            HttpResponse.json({ workItems: related ? [item, pullRequest] : [item] }),
          ),
        );
        const user = userEvent.setup();
        const { client } = renderSection();
        const row = await screen.findByRole('link', { name: session.title });
        await waitFor(() => expect(client.isFetching()).toBe(0));
        if (menu === 'context') fireEvent.contextMenu(row);
        else await user.click(screen.getByRole('button', { name: `Session actions for ${session.title}` }));
        for (const [name, url] of expected) {
          const links = await screen.findAllByRole('menuitem', { name });
          expect(links).toHaveLength(1);
          expect(links[0]).toHaveAttribute('href', url);
          expect(links[0]).toHaveAttribute('target', '_blank');
          expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
        }
        expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/factories\/fp-1$/);
      },
    );
  });

  it.each([
    ['user/my-feature', '/factories/fp-1/user/threads/sess-1'],
    ['slack/1791936483-798759', '/factories/fp-1/user/threads/sess-1'],
    ['work/my-feature', '/factories/fp-1/workspaces/sess-1/threads/sess-1'],
  ])('exposes a direct thread link for %s', async (branch, path) => {
    stubFactoryWithRepository([{ ...existingSession, branch, title: 'Session to open' }]);
    const user = userEvent.setup();
    renderSection();

    const link = await screen.findByRole('link', { name: 'Session to open' });
    expect(link).toHaveAttribute('href', path);
    await user.click(link);
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent(path));
  });

  it('retains the board location when following a factory session link with the keyboard', async () => {
    stubFactoryWithRepository([{ ...existingSession, branch: 'factory/issue-528', title: 'Keyboard session' }]);
    const user = userEvent.setup();
    renderSection('/factories/fp-1?sort=oldest#sessions');

    const link = await screen.findByRole('link', { name: 'Keyboard session' });
    link.focus();
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1/workspaces/sess-1/threads/sess-1'),
    );
    expect(JSON.parse(screen.getByTestId('navigation-state').textContent ?? '')).toMatchObject({
      from: { pathname: '/factories/fp-1', search: '?sort=oldest', hash: '#sessions' },
    });
  });

  it('allows a second right-click to open the native browser menu on session links', async () => {
    stubFactoryWithRepository([existingSession]);
    renderSection();
    const link = await screen.findByRole('link', { name: 'my-feature' });

    expect(fireEvent.contextMenu(link)).toBe(false);
    await screen.findByRole('menuitem', { name: 'Pin session' });
    expect(fireEvent.contextMenu(link)).toBe(true);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it.each(['context', 'dropdown'] as const)('offers navigation and session actions in the %s menu', async menu => {
    stubFactoryWithRepository([existingSession]);
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole('link', { name: 'my-feature' });
    async function openMenu() {
      if (menu === 'context') fireEvent.contextMenu(screen.getByRole('link', { name: 'my-feature' }));
      else await user.click(screen.getByRole('button', { name: 'Session actions for my-feature' }));
    }

    await openMenu();
    await screen.findByRole('menuitem', { name: 'Open in new tab' });
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Open in new tab',
      'Pin session',
      'Regenerate title',
      'Make private',
      'Delete',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toHaveAttribute(
      'href',
      '/factories/fp-1/user/threads/sess-1',
    );
    expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('menuitem', { name: 'Open in Slack' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Pin session' }));
    expect(screen.getByLabelText('my-feature pinned')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/factories\/fp-1$/);
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Unpin' })).toBeInTheDocument();
  });

  it('navigates straight to the session thread without a blocking session create or spinner', async () => {
    stubFactoryWithRepository([existingSession]);

    let createCalls = 0;
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions`, () => {
        createCalls += 1;
        return HttpResponse.json({ controllerId: 'code', resourceId: 'sess-1', threadId: 'sess-1' });
      }),
    );
    const user = userEvent.setup();

    renderSection();

    const row = await screen.findByRole('link', { name: 'my-feature' });
    await user.click(row);

    // Navigation happens immediately, driven purely by the known session id.
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/fp-1/user/threads/sess-1'),
    );
    // The row neither blocks with a spinner nor fires a session create itself —
    // the thread page owns bringing the session online.
    expect(screen.queryByRole('status', { name: 'Opening my-feature' })).not.toBeInTheDocument();
    expect(row).toBeEnabled();
    expect(createCalls).toBe(0);
  });
});
