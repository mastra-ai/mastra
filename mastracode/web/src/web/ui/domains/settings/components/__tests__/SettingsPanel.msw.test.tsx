import type { AgentControllerSessionSettings, AgentControllerSessionState, PermissionRules } from '@mastra/client-js';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../../chat/context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../../e2e/web-ui/render';
import type { Factory } from '../../../workspaces';
import { ActiveFactoryProvider } from '../../../workspaces';
import { OverlaysProvider } from '../../../../lib/overlays';
import { SettingsPanel } from '../../index';
import { loadDoneSound, playDoneSound } from '../../services/doneSound';
import { SettingsNavigationProvider, useSetSettingsSection } from '../../context/SettingsNavigationProvider';

// The completion sound synthesizes audio via AudioContext, which jsdom
// doesn't provide; mock playback (persistence stays real) so specs can
// assert the preview fired.
vi.mock('../../services/doneSound', async importOriginal => ({
  ...(await importOriginal<typeof import('../../services/doneSound')>()),
  playDoneSound: vi.fn(),
}));

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-settings-panel';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-settings-panel';

const project: Factory = {
  id: 'project-settings-panel',
  name: 'Settings Panel Project',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/tmp/settings-panel',
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

function seedFactory() {
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
}

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme-value">{theme}</span>;
}

function SettingsSectionControls() {
  const setSection = useSetSettingsSection();
  return (
    <div aria-label="Settings test controls">
      <button type="button" onClick={() => setSection('source-control')}>
        Show source control settings
      </button>
      <button type="button" onClick={() => setSection('model')}>
        Show model settings
      </button>
      <button type="button" onClick={() => setSection('behavior')}>
        Show behavior settings
      </button>
    </div>
  );
}

function Harness({ children }: { children: ReactNode }) {
  return (
    <MainSidebarProvider storageKey="settings-panel-test" mobileBreakpoint={768}>
      <ActiveFactoryProvider factoryId={project.id}>
        <ChatSessionProvider threadId={THREAD_ID} deferUntilMessagesReady={false}>
          <OverlaysProvider>
            <SettingsNavigationProvider>
              <ThemeProbe />
              <SettingsSectionControls />
              {children}
              <Toaster position="bottom-right" />
            </SettingsNavigationProvider>
          </OverlaysProvider>
        </ChatSessionProvider>
      </ActiveFactoryProvider>
    </MainSidebarProvider>
  );
}

async function renderSettingsPanel() {
  seedFactory();
  const captured = useAgentControllerHandlers();
  const rendered = renderWithProviders(
    <Harness>
      <SettingsPanel />
    </Harness>,
  );
  await waitForMutationsIdle(rendered.client);
  return captured;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SettingsPanel', () => {
  describe('when rendered', () => {
    it('exposes a focused, labelled in-layout section without dialog semantics', async () => {
      await renderSettingsPanel();

      const settings = screen.getByRole('region', { name: 'Settings' });
      const heading = within(settings).getByRole('heading', { name: 'General' });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(settings).queryByRole('navigation', { name: 'Settings sections' })).not.toBeInTheDocument();
      expect(heading).toHaveFocus();
    });
  });

  describe('when changing general preferences', () => {
    it('updates the theme from the real theme provider and omits density controls', async () => {
      const user = userEvent.setup();
      await renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Light' }));

      await waitFor(() => expect(screen.getByTestId('theme-value')).toHaveTextContent('light'));
      expect(screen.queryByText('Density')).not.toBeInTheDocument();
      expect(screen.queryByText('Spacing between messages and controls')).not.toBeInTheDocument();
    });

    it('persists the completion sound choice and previews it', async () => {
      const user = userEvent.setup();
      vi.mocked(playDoneSound).mockClear();
      await renderSettingsPanel();

      const soundGroup = screen.getByRole('group', { name: 'Completion sound' });
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
      await renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Show source control settings' }));
      expect(screen.getByText('/tmp/settings-panel')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Remove Settings Panel Project' }));

      // The route's factory disappears from the stored list, so it stops resolving.
      await user.click(screen.getByRole('button', { name: 'Show source control settings' }));
      await screen.findByText('Select a factory to manage its source control.');
      expect(JSON.parse(localStorage.getItem('mastracode-factories') ?? '[]')).toEqual([]);
    });

    it('keeps the factory visible and reports storage failures', async () => {
      const user = userEvent.setup();
      await renderSettingsPanel();
      await user.click(screen.getByRole('button', { name: 'Show source control settings' }));
      const storageError = new Error('Factory storage is unavailable');
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw storageError;
      });

      await user.click(screen.getByRole('button', { name: 'Remove Settings Panel Project' }));

      expect(await screen.findByText(storageError.message)).toBeInTheDocument();
      expect(screen.getByText('/tmp/settings-panel')).toBeInTheDocument();
      setItem.mockRestore();
    });
  });

  describe('when changing model preferences', () => {
    it('persists the thinking level and updates the selected button', async () => {
      const user = userEvent.setup();
      const captured = await renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Show model settings' }));
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
      await renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Show model settings' }));
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
      await renderSettingsPanel();

      expect(screen.queryByText('Model packs')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Show model settings' }));

      expect(await screen.findByText('Model packs')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New pack/ })).toBeInTheDocument();
      // A local factory has no server-side project, so no default-model picker.
      expect(screen.queryByLabelText('Factory default model')).not.toBeInTheDocument();
    });
  });

  describe('when changing behavior preferences', () => {
    it('updates session settings and permission categories through chat providers', async () => {
      const user = userEvent.setup();
      const captured = await renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Show behavior settings' }));
      const notifications = await screen.findByRole('group', { name: 'Notifications' });
      await user.click(within(notifications).getByRole('button', { name: 'System' }));
      const readPermission = await screen.findByRole('group', { name: 'Read permission' });
      await user.click(within(readPermission).getByRole('button', { name: 'Allow' }));

      await waitFor(() => expect(captured.stateUpdates).toContainEqual({ notifications: 'system' }));
      await waitFor(() => expect(captured.permissions).toContainEqual({ category: 'read', policy: 'allow' }));
    });

    it('keeps notification delivery separate from completion sound previews', async () => {
      const user = userEvent.setup();
      await renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Show behavior settings' }));
      const notifications = await screen.findByRole('group', { name: 'Notifications' });

      expect(screen.queryByRole('button', { name: 'Preview notification sound' })).not.toBeInTheDocument();

      await user.click(within(notifications).getByRole('button', { name: 'System' }));
      expect(screen.queryByRole('button', { name: 'Preview notification sound' })).not.toBeInTheDocument();
    });
  });
});
