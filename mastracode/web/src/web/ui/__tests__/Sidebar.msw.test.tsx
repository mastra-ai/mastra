/**
 * BDD coverage for the propless `Sidebar`.
 *
 * The sidebar consumes the domain contexts directly (`useActiveFactoryContext`,
 * focused chat hooks, `useOverlays`, toast feedback, and `useFactoryAuth`) instead of a
 * drilled prop bag, so the spec drives it end-to-end: real fetch transport,
 * MSW at the network boundary, assertions on the requests the thread actions
 * produce.
 */
import type { AgentControllerSessionState, AgentControllerThreadInfo } from '@mastra/client-js';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../domains/chat/context/ChatSessionTestProvider';
import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { redirectToLogout } from '../domains/auth';
import type * as AuthService from '../domains/auth/services/auth';
import type { Factory, FactoryUserSession } from '../domains/workspaces';
import { ActiveFactoryProvider } from '../domains/workspaces';
import { SettingsNavigationProvider } from '../domains/settings/context/SettingsNavigationProvider';
import { OverlaysProvider } from '../lib/overlays';
import { Sidebar } from '../Sidebar';

// jsdom's `window.location.assign` is unforgeable (cannot be spied on), so the
// service-level navigation helper is stubbed; `fetchAuthState` stays real.
vi.mock('../domains/auth/services/auth', async importOriginal => {
  const actual = await importOriginal<typeof AuthService>();
  return { ...actual, redirectToLogout: vi.fn() };
});

const RESOURCE_ID = 'res-alpha';
const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const SESSION = `${API}/sessions/${RESOURCE_ID}`;

const project: Factory = {
  id: 'p-alpha',
  name: 'Alpha',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/projects/alpha',
  },
};

const secondLocalProject: Factory = {
  id: 'p-beta',
  name: 'Beta',
  resourceId: 'res-beta',
  createdAt: 2,
  binding: {
    kind: 'local',
    path: '/projects/beta',
  },
};

const githubRepository = {
  projectRepositoryId: 'pr-mastra-1',
  slug: 'mastra-ai/mastra',
  gitBranch: 'main',
  sandboxWorkdir: '/sandbox/mastra',
  selectedWorktreePath: '/sandbox/mastra',
  worktrees: [
    { branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' },
    { branch: 'feat-ui', worktreePath: '/sandbox/mastra-worktrees/feat-ui', baseBranch: 'main' },
  ],
};

const githubProject: Factory = {
  id: 'p-github',
  name: 'Mastra',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'factory',
    factoryProjectId: 'fp-github-project-1',
    repositories: [githubRepository],
  },
};

const userSession: FactoryUserSession = {
  id: 'user-session-1',
  sessionId: 'user-session-1',
  projectRepositoryId: githubRepository.projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'user/alice-notes',
  baseBranch: 'main',
  sandboxId: 'sandbox-1',
  sandboxWorkdir: '/sandbox/mastra-worktrees/user-alice-notes',
  materializedAt: null,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
};

const threadOne: AgentControllerThreadInfo = {
  id: 'thread-one',
  title: 'First thread',
  resourceId: RESOURCE_ID,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
};

const threadTwo: AgentControllerThreadInfo = {
  id: 'thread-two',
  title: 'Second thread',
  resourceId: RESOURCE_ID,
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
};

afterEach(() => {
  localStorage.clear();
  vi.mocked(redirectToLogout).mockClear();
});

function seedFactory(active: Factory = project, projects: Factory[] = [active]) {
  localStorage.setItem('mastracode-factories', JSON.stringify(projects));
  localStorage.setItem('mastracode-active-factory', active.id);
}

function useGithubStatusHandler() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, installations: [] }),
    ),
  );
}

function sessionState(): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: threadOne.id,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function sse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function useAuthHandler(state: { authenticated?: boolean; user?: { name?: string; email?: string } } | null = null) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      state ? HttpResponse.json(state) : HttpResponse.json({}, { status: 404 }),
    ),
  );
}

interface CapturedRequests {
  switched: string[];
  created: number;
  deleted: string[];
  renamed: Array<{ threadId: string; title: string }>;
  cloned: Array<Record<string, unknown>>;
}

function useAgentControllerHandlers(): CapturedRequests {
  const captured: CapturedRequests = { switched: [], created: 0, deleted: [], renamed: [], cloned: [] };
  const newThread: AgentControllerThreadInfo = {
    id: 'thread-new',
    title: 'New thread',
    resourceId: RESOURCE_ID,
    createdAt: '2026-06-05T00:00:00.000Z',
    updatedAt: '2026-06-05T00:00:00.000Z',
  };

  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: threadOne.id }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [threadOne, threadTwo] })),
    http.get(`${SESSION}/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse()),
    http.post(`${SESSION}/thread`, async ({ request }) => {
      captured.switched.push(((await request.json()) as { threadId: string }).threadId);
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/threads`, () => {
      captured.created += 1;
      return HttpResponse.json(newThread);
    }),
    http.post(`${SESSION}/threads/clone`, async ({ request }) => {
      captured.cloned.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(newThread);
    }),
    http.delete(`${SESSION}/threads/:threadId`, ({ params }) => {
      captured.deleted.push(String(params.threadId));
      return HttpResponse.json({ ok: true });
    }),
    http.put(`${SESSION}/threads/:threadId`, async ({ params, request }) => {
      captured.renamed.push({
        threadId: String(params.threadId),
        title: ((await request.json()) as { title: string }).title,
      });
      return HttpResponse.json({ ok: true });
    }),
  );

  return captured;
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderSidebar() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/chat']}>
      <MainSidebarProvider storageKey="sidebar-test" mobileBreakpoint={0}>
        <ActiveFactoryProvider>
          <ChatSessionProvider>
            <OverlaysProvider>
              <SettingsNavigationProvider>
                <Sidebar />
                <LocationProbe />
              </SettingsNavigationProvider>
            </OverlaysProvider>
          </ChatSessionProvider>
        </ActiveFactoryProvider>
        <Toaster position="bottom-right" />
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

async function openThreadActions(title: string) {
  const row = (await screen.findByText(title)).closest('[role="listitem"]') as HTMLElement;
  await userEvent.click(within(row).getByRole('button', { name: 'Thread actions' }));
}

describe('Sidebar', () => {
  describe('when a project with threads is active', () => {
    it('lists each thread by title', async () => {
      seedFactory();
      useAuthHandler();
      useAgentControllerHandlers();
      renderSidebar();

      expect(await screen.findByText('First thread')).toBeInTheDocument();
      expect(await screen.findByText('Second thread')).toBeInTheDocument();
    });

    it('keeps project, navigation, and account sections in order', async () => {
      seedFactory();
      useAuthHandler({ authenticated: true, user: { name: 'Ada Lovelace' } });
      useAgentControllerHandlers();
      renderSidebar();

      const projectSwitcher = await screen.findByRole('region', { name: 'Factory switcher' });
      const navigation = screen.getByRole('region', { name: 'Navigation' });
      const account = screen.getByRole('region', { name: 'Account and settings' });

      expect(within(projectSwitcher).getByRole('button', { name: 'Select factory' })).toBeInTheDocument();
      expect(await within(navigation).findByText('First thread')).toBeInTheDocument();
      const footerNavigation = within(account).getByRole('list');
      expect(within(footerNavigation).getByRole('button', { name: 'Sign out' })).toHaveTextContent('Ada Lovelace');
      const settingsTrigger = within(footerNavigation).getByRole('button', { name: 'Settings' });
      expect(settingsTrigger).toHaveTextContent('Settings');
      expect(settingsTrigger).toHaveAttribute('id', 'settings-trigger');
      expect(settingsTrigger).not.toHaveAttribute('aria-current');
      expect(projectSwitcher.compareDocumentPosition(navigation)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(navigation.compareDocumentPosition(account)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('replaces the main navigation with settings sections and restores it from the back button or footer', async () => {
      const user = userEvent.setup();
      seedFactory();
      useAuthHandler();
      useAgentControllerHandlers();
      renderSidebar();

      expect(await screen.findByText('First thread')).toBeInTheDocument();
      const settingsTrigger = screen.getByRole('button', { name: 'Settings' });

      await user.click(settingsTrigger);

      const settingsNavigation = screen.getByRole('navigation', { name: 'Settings sections' });
      const generalButton = within(settingsNavigation).getByRole('button', { name: 'General' });
      const backButton = within(settingsNavigation).getByRole('button', { name: 'Back to app' });
      const behaviorButton = within(settingsNavigation).getByRole('button', { name: 'Behavior' });
      expect(settingsTrigger).toHaveAttribute('aria-current', 'page');
      expect(generalButton).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByRole('region', { name: 'Factory switcher' })).not.toBeInTheDocument();
      expect(backButton.compareDocumentPosition(generalButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

      await user.click(behaviorButton);
      expect(behaviorButton).toHaveAttribute('aria-current', 'page');
      expect(generalButton).not.toHaveAttribute('aria-current');

      await user.click(backButton);

      expect(settingsTrigger).not.toHaveAttribute('aria-current');
      expect(await screen.findByText('First thread')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Settings sections' })).not.toBeInTheDocument();

      await user.click(settingsTrigger);
      expect(
        within(screen.getByRole('navigation', { name: 'Settings sections' })).getByRole('button', { name: 'General' }),
      ).toHaveAttribute('aria-current', 'page');

      await user.click(settingsTrigger);
      expect(settingsTrigger).not.toHaveAttribute('aria-current');
      expect(await screen.findByText('First thread')).toBeInTheDocument();
    });

    it('filters settings sections by section names and control keywords', async () => {
      const user = userEvent.setup();
      seedFactory();
      useAuthHandler();
      useAgentControllerHandlers();
      renderSidebar();

      expect(await screen.findByText('First thread')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Settings' }));

      const settingsNavigation = screen.getByRole('navigation', { name: 'Settings sections' });
      const search = within(settingsNavigation).getByRole('searchbox', { name: 'Search settings' });

      await user.type(search, 'notifications');

      expect(within(settingsNavigation).getByRole('button', { name: 'Behavior' })).toBeInTheDocument();
      expect(within(settingsNavigation).queryByRole('button', { name: 'General' })).not.toBeInTheDocument();

      await user.clear(search);
      expect(within(settingsNavigation).getByRole('button', { name: 'General' })).toBeInTheDocument();

      await user.type(search, 'not a setting');
      expect(within(settingsNavigation).getByRole('status')).toHaveTextContent('No settings found.');
      expect(within(settingsNavigation).getByRole('button', { name: 'Back to app' })).toBeInTheDocument();
    });

    it('navigates to the thread page when a thread is clicked', async () => {
      seedFactory();
      useAuthHandler();
      useAgentControllerHandlers();
      renderSidebar();

      await userEvent.click(await screen.findByText('Second thread'));

      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/threads/thread-two'));
    });

    it('opens the /new draft page without persisting a thread when the new-thread control is clicked', async () => {
      seedFactory();
      useAuthHandler();
      const captured = useAgentControllerHandlers();
      renderSidebar();

      await screen.findByText('First thread');
      await userEvent.click(screen.getByRole('button', { name: 'New thread' }));

      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/new'));
      expect(captured.created).toBe(0);
    });

    it('switches projects inline and keeps destructive actions out of the menu', async () => {
      seedFactory(project, [project, secondLocalProject, githubProject]);
      useAuthHandler();
      useGithubStatusHandler();
      useAgentControllerHandlers();
      renderSidebar();

      await userEvent.click(await screen.findByRole('button', { name: 'Select factory' }));

      expect(await screen.findByRole('menuitem', { name: /^Mastra\b/ })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Create Factory' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /remove/i })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('menuitem', { name: /^Beta\b/ }));

      await waitFor(() => expect(localStorage.getItem('mastracode-active-factory')).toBe(secondLocalProject.id));
      expect(await screen.findByText('Beta')).toBeInTheDocument();
    });
  });

  describe('when a GitHub factory is active', () => {
    it('lists Factory sessions directly without showing the repository root', async () => {
      seedFactory(githubProject);
      useAuthHandler();
      useGithubStatusHandler();
      useAgentControllerHandlers();
      renderSidebar();

      const factory = await screen.findByRole('navigation', { name: 'Factory' });
      const workSessions = within(factory).getByRole('region', { name: 'Work Sessions' });
      expect(within(workSessions).getByRole('button', { name: 'feat-ui' })).toBeInTheDocument();
      expect(within(factory).queryByRole('button', { name: 'main' })).not.toBeInTheDocument();
    });

    it('hides role-based Factory session sections when none exist', async () => {
      seedFactory({
        ...githubProject,
        binding: {
          kind: 'factory',
          factoryProjectId: 'fp-github-project-1',
          repositories: [{ ...githubRepository, worktrees: [githubRepository.worktrees[0]!] }],
        },
      });
      useAuthHandler();
      useGithubStatusHandler();
      useAgentControllerHandlers();
      renderSidebar();

      const factory = await screen.findByRole('navigation', { name: 'Factory' });
      expect(within(factory).queryByRole('region', { name: 'Work Sessions' })).not.toBeInTheDocument();
      expect(within(factory).queryByRole('region', { name: 'Review Sessions' })).not.toBeInTheDocument();
    });

    it('renders the User Sessions section and no thread list', async () => {
      seedFactory(githubProject);
      useAuthHandler();
      useGithubStatusHandler();
      useAgentControllerHandlers();
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/fp-github-project-1/work-items`, () =>
          HttpResponse.json({ workItems: [] }),
        ),
        http.get(`${TEST_BASE_URL}/web/github/projects/${githubRepository.projectRepositoryId}/sessions`, () =>
          HttpResponse.json({ sessions: [userSession] }),
        ),
      );
      renderSidebar();

      const userSessions = await screen.findByRole('region', { name: 'User sessions' });
      expect(await within(userSessions).findByRole('button', { name: 'alice-notes' })).toBeInTheDocument();
      // Each worktree holds a single conversation, so GitHub projects have no
      // thread list — neither nested nor flat.
      await screen.findByRole('button', { name: 'feat-ui' });
      expect(screen.queryByText('First thread')).not.toBeInTheDocument();
    });
  });

  describe('when opening a thread action menu', () => {
    it('clones the thread', async () => {
      seedFactory();
      useAuthHandler();
      const captured = useAgentControllerHandlers();
      renderSidebar();

      await openThreadActions('Second thread');
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Clone' }));

      await waitFor(() => expect(captured.cloned).toEqual([{ sourceThreadId: 'thread-two' }]));
    });

    it('deletes the thread', async () => {
      seedFactory();
      useAuthHandler();
      const captured = useAgentControllerHandlers();
      renderSidebar();

      await openThreadActions('Second thread');
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));

      await waitFor(() => expect(captured.deleted).toContain('thread-two'));
    });

    it('renames the thread on Enter', async () => {
      seedFactory();
      useAuthHandler();
      const captured = useAgentControllerHandlers();
      renderSidebar();

      await openThreadActions('Second thread');
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Rename' }));
      const input = screen.getByRole('textbox', { name: 'Thread title' });
      await userEvent.clear(input);
      await userEvent.type(input, 'Renamed{Enter}');

      await waitFor(() => expect(captured.renamed).toContainEqual({ threadId: 'thread-two', title: 'Renamed' }));
    });
  });

  describe('when no project is active', () => {
    it('hides the threads section', async () => {
      useAuthHandler();
      renderSidebar();

      expect(await screen.findByText('Select a factory…')).toBeInTheDocument();
      expect(screen.queryByText('First thread')).not.toBeInTheDocument();
    });
  });

  describe('while the sign-in check is pending', () => {
    it('renders a skeleton placeholder, then the identity row', async () => {
      seedFactory();
      server.use(
        http.get(`${TEST_BASE_URL}/auth/me`, async () => {
          await delay(150);
          return HttpResponse.json({ authenticated: true, user: { name: 'Ada Lovelace' } });
        }),
      );
      useAgentControllerHandlers();
      renderSidebar();

      expect(await screen.findByRole('status', { name: 'Checking sign-in' })).toBeInTheDocument();
      expect(screen.queryByText(/Checking sign-in/)).not.toBeInTheDocument();

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Checking sign-in' })).not.toBeInTheDocument();
    });
  });

  describe('when the server reports a signed-in user', () => {
    it('shows the identity and signs out via the auth service', async () => {
      seedFactory();
      useAuthHandler({ authenticated: true, user: { name: 'Ada Lovelace', email: 'ada@example.com' } });
      useAgentControllerHandlers();
      renderSidebar();

      expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

      expect(redirectToLogout).toHaveBeenCalledWith(TEST_BASE_URL);
    });
  });
});
