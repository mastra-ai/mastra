import type { MastraDBMessage } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import { assistantOnlyThreadMessages, threadRailMessages } from './fixtures/thread-rail';

const FACTORY_ID = 'factory-thread-rail';
const REPOSITORY_ID = 'repository-thread-rail';
const SESSION_ID = 'session-thread-rail';
const AGENT_CONTROLLER_API = `${TEST_BASE_URL}/api/agent-controller/code`;
const SIDEBAR_STATE_KEY = 'mastracode-web:sidebar:state';

const workspaceSession = {
  id: 'workspace-session-row',
  sessionId: SESSION_ID,
  projectRepositoryId: REPOSITORY_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/thread-rail',
  baseBranch: 'main',
  sandboxId: 'sandbox-1',
  sandboxWorkdir: '/workspace/acme',
  materializedAt: '2026-08-03T09:00:00.000Z',
  createdAt: '2026-08-03T09:00:00.000Z',
  updatedAt: '2026-08-03T09:00:00.000Z',
};

function stubThreadRoute(messages: MastraDBMessage[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            installationId: 'installation-1',
            repositories: [
              {
                id: REPOSITORY_ID,
                branch: 'main',
                sandboxWorkdir: '/workspace/acme',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    http.post(`${AGENT_CONTROLLER_API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID }),
    ),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.put(`${AGENT_CONTROLLER_API}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AGENT_CONTROLLER_API}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads`, () =>
      HttpResponse.json({ threads: [{ id: SESSION_ID, title: 'Factory thread' }] }),
    ),
    http.get(`${AGENT_CONTROLLER_API}/sessions/:resourceId/threads/:threadId/messages`, () =>
      HttpResponse.json({ messages }),
    ),
    http.get(`${AGENT_CONTROLLER_API}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/workspace/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );
}

function renderThreadRoute(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  return renderWithProviders(<RouterProvider router={router} />);
}

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

/** jsdom reports every box as 0×0, so the rail threshold needs a width to measure against. */
function stubScrollerWidth(width: number) {
  HTMLElement.prototype.getBoundingClientRect = () => ({
    width,
    height: 800,
    top: 0,
    left: 0,
    right: width,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

beforeEach(() => {
  stubScrollerWidth(1200);
});

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  window.localStorage.removeItem(SIDEBAR_STATE_KEY);
});

describe('ThreadPage conversation rail', () => {
  describe('when a workspace thread contains no user turns', () => {
    it('does not render conversation navigation', async () => {
      stubThreadRoute(assistantOnlyThreadMessages);
      renderThreadRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`);

      expect(await screen.findByText('There are no user turns in this thread.')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Conversation timeline' })).not.toBeInTheDocument();
    });
  });

  describe('when the docked workspace card leaves no room beside the column', () => {
    it('does not render conversation navigation', async () => {
      // 704px = the 44rem column with zero gutter, what the scroller is left with
      // once the workspace card claims its inset.
      stubScrollerWidth(704);
      stubThreadRoute(threadRailMessages);
      renderThreadRoute(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`);

      expect(await screen.findByText('Run the focused checks')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Conversation timeline' })).not.toBeInTheDocument();
    });
  });

  describe('when a user-session thread contains multiple user turns', () => {
    it('renders one jump control per user turn and marks the latest turn', async () => {
      stubThreadRoute(threadRailMessages);
      renderThreadRoute(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`);

      const rail = await screen.findByRole('navigation', { name: 'Conversation timeline' });
      const jumpControls = within(rail).getAllByRole('button', { name: /Jump to/ });

      expect(jumpControls).toHaveLength(2);
      expect(within(rail).getByRole('button', { name: 'Jump to Review the implementation plan' })).toBeInTheDocument();
      await waitFor(() =>
        expect(within(rail).getByRole('button', { name: 'Jump to Run the focused checks' })).toHaveAttribute(
          'aria-current',
          'location',
        ),
      );
    });

    it('shows the same turn preview for hover and keyboard focus', async () => {
      stubThreadRoute(threadRailMessages);
      renderThreadRoute(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`);

      const firstTurn = await screen.findByRole('button', { name: 'Jump to Review the implementation plan' });
      fireEvent.mouseEnter(firstTurn);

      const preview = within(screen.getByTestId('thread-rail-preview-current'));
      expect(preview.getByText('The implementation is ready to review.')).toBeInTheDocument();
      expect(preview.getByText('plan.md')).toBeInTheDocument();

      const secondTurn = screen.getByRole('button', { name: 'Jump to Run the focused checks' });
      fireEvent.focus(secondTurn);
      await waitFor(() =>
        expect(
          within(screen.getByTestId('thread-rail-preview-current')).getByText('Run the focused checks'),
        ).toBeInTheDocument(),
      );
    });

    it('scrolls the transcript to the selected user turn', async () => {
      const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
      const scrollTo = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        writable: true,
        value: scrollTo,
      });

      try {
        stubThreadRoute(threadRailMessages);
        renderThreadRoute(`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`);

        const firstTurn = await screen.findByRole('button', { name: 'Jump to Review the implementation plan' });
        scrollTo.mockClear();
        fireEvent.click(firstTurn);

        expect(scrollTo).toHaveBeenCalledTimes(1);
      } finally {
        if (originalScrollTo) {
          Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
        }
      }
    });
  });
});
