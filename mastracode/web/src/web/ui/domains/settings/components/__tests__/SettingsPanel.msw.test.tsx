import type { AgentControllerSessionState, PermissionRules } from '@mastra/client-js';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../../chat/context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
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

function useAgentControllerHandlers(): CapturedRequests {
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
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, async ({ request }) => {
      const body = await request.json();
      if (body && typeof body === 'object' && 'state' in body && body.state && typeof body.state === 'object') {
        captured.stateUpdates.push(body.state);
      }
      return HttpResponse.json(sessionState());
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
    http.get(`${SESSION}/stream`, () => sse()),
    // The Model tab hosts the packs section now, so opening it loads the catalog.
    http.get(`${TEST_BASE_URL}/web/config/model-packs`, () => HttpResponse.json({ packs: [], activePackId: null })),
  );

  return captured;
}

function seedFactory() {
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-factory', project.id);
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
      <ActiveFactoryProvider>
        <ChatSessionProvider threadId={THREAD_ID} deferUntilMessagesReady={false}>
          <OverlaysProvider>
            <SettingsNavigationProvider>
              <ThemeProbe />
              <SettingsSectionControls />
              {children}
            </SettingsNavigationProvider>
          </OverlaysProvider>
        </ChatSessionProvider>
      </ActiveFactoryProvider>
    </MainSidebarProvider>
  );
}

function renderSettingsPanel() {
  seedFactory();
  const captured = useAgentControllerHandlers();
  renderWithProviders(
    <Harness>
      <SettingsPanel />
    </Harness>,
  );
  return captured;
}

afterEach(() => {
  localStorage.clear();
});

describe('SettingsPanel', () => {
  describe('when rendered', () => {
    it('exposes a focused, labelled in-layout section without dialog semantics', () => {
      renderSettingsPanel();

      const settings = screen.getByRole('region', { name: 'Settings' });
      const heading = within(settings).getByRole('heading', { name: 'Settings' });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(settings).queryByRole('navigation', { name: 'Settings sections' })).not.toBeInTheDocument();
      expect(heading).toHaveFocus();
    });
  });

  describe('when changing general preferences', () => {
    it('updates the theme from the real theme provider and omits density controls', async () => {
      const user = userEvent.setup();
      renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Light' }));

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
      expect(screen.queryByText('Density')).not.toBeInTheDocument();
      expect(screen.queryByText('Spacing between messages and controls')).not.toBeInTheDocument();
    });

    it('persists the completion sound choice and previews it', async () => {
      const user = userEvent.setup();
      vi.mocked(playDoneSound).mockClear();
      renderSettingsPanel();

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
      renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Show source control settings' }));
      expect(screen.getByText('/tmp/settings-panel')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Remove Settings Panel Project' }));

      await waitFor(() => expect(localStorage.getItem('mastracode-active-factory')).toBeNull());
      await user.click(screen.getByRole('button', { name: 'Show source control settings' }));
      await screen.findByText('Select a factory to manage its source control.');
      expect(JSON.parse(localStorage.getItem('mastracode-factories') ?? '[]')).toEqual([]);
    });

    it('keeps the factory visible and reports storage failures', async () => {
      const user = userEvent.setup();
      renderSettingsPanel();
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
    it('updates the thinking level through the chat settings provider', async () => {
      const user = userEvent.setup();
      const captured = renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Show model settings' }));
      await user.click(await screen.findByRole('button', { name: 'High' }));

      await waitFor(() => expect(captured.stateUpdates).toContainEqual({ thinkingLevel: 'high' }));
    });

    it('hosts model packs inside the Model settings section', async () => {
      const user = userEvent.setup();
      renderSettingsPanel();

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
      const captured = renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Show behavior settings' }));
      const notifications = await screen.findByRole('group', { name: 'Notifications' });
      await user.click(within(notifications).getByRole('button', { name: 'System' }));
      const readPermission = await screen.findByRole('group', { name: 'Read permission' });
      await user.click(within(readPermission).getByRole('button', { name: 'Allow' }));

      await waitFor(() => expect(captured.stateUpdates).toContainEqual({ notifications: 'system' }));
      await waitFor(() => expect(captured.permissions).toContainEqual({ category: 'read', policy: 'allow' }));
    });
  });
});
