import type { AgentControllerSessionSettings, AgentControllerSessionState, PermissionRules } from '@mastra/client-js';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../chat/context/ChatSessionTestProvider';
import { server } from '../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/web-ui/render';
import type { Factory } from '../../workspaces';
import { ActiveFactoryProvider } from '../../workspaces';
import { OverlaysProvider } from '../../../lib/overlays';
import { SettingsPage } from '../../../pages/SettingsPage';
import { loadDoneSound, playDoneSound } from '../services/doneSound';

// The completion sound synthesizes audio via AudioContext, which jsdom
// doesn't provide; mock playback (persistence stays real) so specs can
// assert the preview fired.
vi.mock('../services/doneSound', async importOriginal => ({
  ...(await importOriginal<typeof import('../services/doneSound')>()),
  playDoneSound: vi.fn(),
}));

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-settings-page';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-settings-page';

const project: Factory = {
  id: 'project-settings-page',
  name: 'Settings Page Project',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/tmp/settings-page',
  },
};

const serverProjectWithoutWorktree: Factory = {
  id: 'server-project-settings-panel',
  name: 'Server Settings Panel Project',
  resourceId: RESOURCE_ID,
  createdAt: 2,
  binding: {
    kind: 'factory',
    factoryProjectId: 'factory-project-settings-panel',
    repositories: [{ projectRepositoryId: 'repo-settings-panel', slug: 'acme/repo', worktrees: [] }],
  },
};

interface CapturedRequests {
  modelIds: string[];
  stateUpdates: Record<string, unknown>[];
  permissions: Array<{ category: string; policy: string }>;
}

function sessionState(): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function permissions(): PermissionRules {
  return { categories: { read: 'ask' }, tools: {} };
}

function sse(): Response {
  return new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

function isThinkingLevel(value: unknown): value is AgentControllerSessionSettings['thinkingLevel'] {
  return value === 'off' || value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh';
}

function isNotificationMode(value: unknown): value is AgentControllerSessionSettings['notifications'] {
  return value === 'off' || value === 'bell' || value === 'system' || value === 'both';
}

function useAgentControllerHandlers(): CapturedRequests {
  let state = sessionState();
  const captured: CapturedRequests = { modelIds: [], stateUpdates: [], permissions: [] };

  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', name: 'Build' }] })),
    http.get(`${API}/models`, () =>
      HttpResponse.json({
        models: [
          {
            id: 'openai/gpt-4o-mini',
            provider: 'openai',
            modelName: 'gpt-4o-mini',
            hasApiKey: true,
            useCount: 1,
          },
          {
            id: 'anthropic/claude-sonnet',
            provider: 'anthropic',
            modelName: 'claude-sonnet',
            hasApiKey: true,
            useCount: 0,
          },
        ],
      }),
    ),
    http.get(SESSION, () => HttpResponse.json(state)),
    http.put(`${SESSION}/state`, async ({ request }) => {
      const body = await request.json();
      if (body && typeof body === 'object' && 'state' in body && body.state && typeof body.state === 'object') {
        captured.stateUpdates.push(body.state);
        const currentSettings: AgentControllerSessionSettings = state.settings ?? {
          yolo: false,
          thinkingLevel: 'medium',
          notifications: 'bell',
          smartEditing: true,
        };
        state = {
          ...state,
          settings: {
            yolo: 'yolo' in body.state && typeof body.state.yolo === 'boolean' ? body.state.yolo : currentSettings.yolo,
            thinkingLevel:
              'thinkingLevel' in body.state && isThinkingLevel(body.state.thinkingLevel)
                ? body.state.thinkingLevel
                : currentSettings.thinkingLevel,
            notifications:
              'notifications' in body.state && isNotificationMode(body.state.notifications)
                ? body.state.notifications
                : currentSettings.notifications,
            smartEditing:
              'smartEditing' in body.state && typeof body.state.smartEditing === 'boolean'
                ? body.state.smartEditing
                : currentSettings.smartEditing,
          },
        };
      }
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${SESSION}/model`, async ({ request }) => {
      const body = await request.json();
      if (body && typeof body === 'object' && 'modelId' in body && typeof body.modelId === 'string') {
        captured.modelIds.push(body.modelId);
      }
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json(permissions())),
    http.put(`${SESSION}/permissions/category`, async ({ request }) => {
      const body = await request.json();
      if (
        body &&
        typeof body === 'object' &&
        'category' in body &&
        typeof body.category === 'string' &&
        'policy' in body &&
        typeof body.policy === 'string'
      ) {
        captured.permissions.push({ category: body.category, policy: body.policy });
      }
      return HttpResponse.json({ ok: true });
    }),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse()),
    // The Model tab hosts the packs section now, so opening it loads the catalog.
    http.get(`${TEST_BASE_URL}/web/config/model-packs`, () => HttpResponse.json({ packs: [], activePackId: null })),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, repositoryIds: [] }, linear: { enabled: false, projectIds: [] } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
  );

  return captured;
}

function seedFactory(factory: Factory = project) {
  localStorage.setItem('mastracode-factories', JSON.stringify([factory]));
}

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme-value">{theme}</span>;
}

interface RenderOptions {
  initialEntry?: string | { pathname: string; state?: unknown };
  factory?: Factory;
}

async function renderSettingsPage(options?: RenderOptions) {
  const factory = options?.factory ?? project;
  seedFactory(factory);
  const captured = useAgentControllerHandlers();
  const router = createMemoryRouter(
    [
      { path: '/factories/:factoryId/settings/:section', element: <SettingsPage /> },
      { path: '*', element: <p>Outside settings</p> },
    ],
    { initialEntries: [options?.initialEntry ?? `/factories/${factory.id}/settings/general`] },
  );
  const rendered = renderWithProviders(
    <MainSidebarProvider storageKey="settings-page-test" mobileBreakpoint={768}>
      <ActiveFactoryProvider factoryId={options?.factory?.id ?? project.id}>
        <ChatSessionProvider threadId={THREAD_ID} deferUntilMessagesReady={false}>
          <OverlaysProvider>
            <ThemeProbe />
            <RouterProvider router={router} />
            <Toaster position="bottom-right" />
          </OverlaysProvider>
        </ChatSessionProvider>
      </ActiveFactoryProvider>
    </MainSidebarProvider>,
  );
  await waitForMutationsIdle(rendered.client);
  return { captured, router };
}

async function openSection(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(await screen.findByRole('link', { name: label }));
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SettingsPage', () => {
  describe('when rendered', () => {
    it('exposes a focused, labelled section with the sidebar navigation outside the content region', async () => {
      await renderSettingsPage();

      const settings = await screen.findByRole('region', { name: 'Settings' });
      const heading = within(settings).getByRole('heading', { name: 'General' });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(settings).queryByRole('navigation', { name: 'Settings sections' })).not.toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Settings sections' })).toBeInTheDocument();
      expect(heading).toHaveFocus();
    });

    it('navigates between sections through links that only change the URL section segment', async () => {
      const user = userEvent.setup();
      const { router } = await renderSettingsPage();

      await openSection(user, 'Source Control');

      expect(router.state.location.pathname).toBe(`/factories/${project.id}/settings/source-control`);
      expect(await screen.findByRole('heading', { name: 'Source Control' })).toBeInTheDocument();
    });
  });

  describe('when leaving settings', () => {
    it('returns to the origin page carried in navigation state via Back to app', async () => {
      const user = userEvent.setup();
      const { router } = await renderSettingsPage({
        initialEntry: { pathname: `/factories/${project.id}/settings/general`, state: { from: { pathname: '/threads/t1' } } },
      });
      await screen.findByRole('region', { name: 'Settings' });

      await user.click(screen.getByRole('button', { name: 'Back to app' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/threads/t1'));
    });

    it('falls back to the draft composer for deep links without an origin', async () => {
      const user = userEvent.setup();
      const { router } = await renderSettingsPage();
      await screen.findByRole('region', { name: 'Settings' });

      await user.click(screen.getByRole('button', { name: 'Back to app' }));

      await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${project.id}/new`));
    });

    it('does not navigate away when pressing Escape', async () => {
      const user = userEvent.setup();
      const { router } = await renderSettingsPage({
        initialEntry: { pathname: `/factories/${project.id}/settings/general`, state: { from: { pathname: '/threads/t1' } } },
      });
      await screen.findByRole('region', { name: 'Settings' });

      await user.keyboard('{Escape}');

      expect(router.state.location.pathname).toBe(`/factories/${project.id}/settings/general`);
    });
  });

  describe('when changing general preferences', () => {
    it('updates the theme from the real theme provider and omits density controls', async () => {
      const user = userEvent.setup();
      await renderSettingsPage();

      await user.click(await screen.findByRole('button', { name: 'Light' }));

      await waitFor(() => expect(screen.getByTestId('theme-value')).toHaveTextContent('light'));
      expect(screen.queryByText('Density')).not.toBeInTheDocument();
      expect(screen.queryByText('Spacing between messages and controls')).not.toBeInTheDocument();
    });

    it('persists the completion sound choice and previews it', async () => {
      const user = userEvent.setup();
      vi.mocked(playDoneSound).mockClear();
      await renderSettingsPage();

      const soundGroup = await screen.findByRole('group', { name: 'Completion sound' });
      await user.click(within(soundGroup).getByRole('button', { name: 'Arcade' }));

      expect(loadDoneSound()).toBe('arcade');
      expect(playDoneSound).toHaveBeenCalledWith('arcade');

      await user.click(within(soundGroup).getByRole('button', { name: 'None' }));
      expect(loadDoneSound()).toBe('none');
    });
  });

  describe('when managing source control', () => {
    it('removes the active factory and reconciles the factory selection', async () => {
      const user = userEvent.setup();
      await renderSettingsPage();

      await openSection(user, 'Source Control');
      expect(await screen.findByText('/tmp/settings-page')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Remove Settings Page Project' }));

      // The section is URL-addressed, so the empty state renders in place.
      await screen.findByText('Select a factory to manage its source control.');
      expect(JSON.parse(localStorage.getItem('mastracode-factories') ?? '[]')).toEqual([]);
    });

    it('keeps the factory visible and reports storage failures', async () => {
      const user = userEvent.setup();
      await renderSettingsPage();
      await openSection(user, 'Source Control');
      await screen.findByText('/tmp/settings-page');
      const storageError = new Error('Factory storage is unavailable');
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw storageError;
      });

      await user.click(screen.getByRole('button', { name: 'Remove Settings Page Project' }));

      expect(await screen.findByText(storageError.message)).toBeInTheDocument();
      expect(screen.getByText('/tmp/settings-page')).toBeInTheDocument();
      setItem.mockRestore();
    });
  });

  describe('when changing model preferences', () => {
    it('persists the thinking level and updates the selected button', async () => {
      const user = userEvent.setup();
      const { captured } = await renderSettingsPage();

      await openSection(user, 'Model');
      const thinkingLevel = await screen.findByRole('group', { name: 'Thinking level' });
      await waitFor(() => expect(within(thinkingLevel).getByRole('button', { name: 'Medium' })).toBePressed());
      await user.click(within(thinkingLevel).getByRole('button', { name: 'High' }));

      await waitFor(() => expect(captured.stateUpdates).toContainEqual({ thinkingLevel: 'high' }));
      await waitFor(() => expect(within(thinkingLevel).getByRole('button', { name: 'High' })).toBePressed());
      expect(within(thinkingLevel).getByRole('button', { name: 'Medium' })).not.toBePressed();
      expect(await screen.findByText('Settings updated')).toBeInTheDocument();
    });

    it('reports an acknowledged but unpersisted update and restores the selected button', async () => {
      const user = userEvent.setup();
      await renderSettingsPage();

      await openSection(user, 'Model');
      const thinkingLevel = await screen.findByRole('group', { name: 'Thinking level' });
      await waitFor(() => expect(within(thinkingLevel).getByRole('button', { name: 'Medium' })).toBePressed());
      server.use(http.put(`${SESSION}/state`, () => HttpResponse.json({ ok: true })));
      await user.click(within(thinkingLevel).getByRole('button', { name: 'High' }));

      expect(await screen.findByText(/Failed to update settings/)).toBeInTheDocument();
      expect(within(thinkingLevel).getByRole('button', { name: 'Medium' })).toBePressed();
      expect(within(thinkingLevel).getByRole('button', { name: 'High' })).not.toBePressed();
    });

    it('hosts model packs inside the Model settings section', async () => {
      const user = userEvent.setup();
      await renderSettingsPage();

      await screen.findByRole('region', { name: 'Settings' });
      expect(screen.queryByText('Model packs')).not.toBeInTheDocument();
      await openSection(user, 'Model');

      expect(await screen.findByText('Model packs')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New pack/ })).toBeInTheDocument();
      // A local factory has no server-side project, so no default-model picker.
      expect(screen.queryByLabelText('Factory default model')).not.toBeInTheDocument();
    });

    it('keeps pack activation available when an active server factory has no worktree selected', async () => {
      const user = userEvent.setup();
      let activateBody: unknown;
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects/factory-project-settings-panel`, () =>
          HttpResponse.json({
            project: {
              id: 'factory-project-settings-panel',
              name: 'Server Settings Panel Project',
              defaultModelId: null,
            },
          }),
        ),
        http.get(`${TEST_BASE_URL}/web/config/model-packs`, () =>
          HttpResponse.json({
            packs: [
              {
                id: 'openai',
                name: 'OpenAI',
                description: 'OpenAI models',
                models: { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' },
                custom: false,
                active: false,
              },
            ],
            activePackId: null,
          }),
        ),
        http.post(`${TEST_BASE_URL}/web/config/model-packs/openai/activate`, async ({ request }) => {
          activateBody = await request.json();
          return HttpResponse.json({ ok: true, activePackId: 'openai' });
        }),
      );
      await renderSettingsPage({ factory: serverProjectWithoutWorktree });

      await openSection(user, 'Model');

      const activate = await screen.findByRole('button', { name: 'Activate' });
      expect(activate).toBeEnabled();
      await user.click(activate);
      await waitFor(() => expect(activateBody).toEqual({ resourceId: RESOURCE_ID }));
    });
  });

  describe('when changing behavior preferences', () => {
    it('updates session settings and permission categories through chat providers', async () => {
      const user = userEvent.setup();
      const { captured } = await renderSettingsPage();

      await openSection(user, 'Behavior');
      const notifications = await screen.findByRole('group', { name: 'Notifications' });
      await user.click(within(notifications).getByRole('button', { name: 'System' }));
      const readPermission = await screen.findByRole('group', { name: 'Read permission' });
      await user.click(within(readPermission).getByRole('button', { name: 'Allow' }));

      await waitFor(() => expect(captured.stateUpdates).toContainEqual({ notifications: 'system' }));
      await waitFor(() => expect(captured.permissions).toContainEqual({ category: 'read', policy: 'allow' }));
    });

    it('keeps notification delivery separate from completion sound previews', async () => {
      const user = userEvent.setup();
      await renderSettingsPage();

      await openSection(user, 'Behavior');
      const notifications = await screen.findByRole('group', { name: 'Notifications' });

      expect(screen.queryByRole('button', { name: 'Preview notification sound' })).not.toBeInTheDocument();

      await user.click(within(notifications).getByRole('button', { name: 'System' }));
      expect(screen.queryByRole('button', { name: 'Preview notification sound' })).not.toBeInTheDocument();
    });
  });
});
