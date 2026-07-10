import type { AgentControllerSessionState, PermissionRules } from '@mastra/client-js';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { ChatCommandsProvider } from '../../../chat/context/ChatCommandsProvider';
import { ChatSessionProvider } from '../../../chat/context/ChatSessionProvider';
import { OverlaysProvider } from '../../../../lib/overlays';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider } from '../../../workspaces';
import { SettingsPanel } from '../../index';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-settings-panel';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-settings-panel';

const project: Project = {
  id: 'project-settings-panel',
  name: 'Settings Panel Project',
  path: '/tmp/settings-panel',
  resourceId: RESOURCE_ID,
  createdAt: 1,
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
  );

  return captured;
}

function seedProject() {
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
}

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme-value">{theme}</span>;
}

function Harness({ children }: { children: ReactNode }) {
  return (
    <ActiveProjectProvider>
      <ChatSessionProvider>
        <OverlaysProvider>
          <ChatCommandsProvider>
            <ThemeProbe />
            {children}
          </ChatCommandsProvider>
        </OverlaysProvider>
      </ChatSessionProvider>
    </ActiveProjectProvider>
  );
}

function renderSettingsPanel() {
  seedProject();
  const captured = useAgentControllerHandlers();
  renderWithProviders(
    <Harness>
      <SettingsPanel onClose={() => {}} />
    </Harness>,
  );
  return captured;
}

afterEach(() => {
  localStorage.clear();
});

describe('SettingsPanel', () => {
  describe('when changing general preferences', () => {
    it('updates the theme from the real theme provider and omits density controls', async () => {
      const user = userEvent.setup();
      renderSettingsPanel();

      await user.click(screen.getByRole('button', { name: 'Light' }));

      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
      expect(screen.queryByText('Density')).not.toBeInTheDocument();
      expect(screen.queryByText('Spacing between messages and controls')).not.toBeInTheDocument();
    });
  });

  describe('when changing model preferences', () => {
    it('switches the selected model through the chat model provider', async () => {
      const user = userEvent.setup();
      const captured = renderSettingsPanel();

      await user.click(screen.getByRole('tab', { name: /model/i }));
      await user.click(await screen.findByRole('button', { name: /openai \/ gpt-4o-mini/i }));
      await user.click(screen.getByRole('option', { name: /claude-sonnet anthropic/i }));

      await waitFor(() => expect(captured.modelIds).toContain('anthropic/claude-sonnet'));
    });
  });

  describe('when changing behavior preferences', () => {
    it('updates session settings and permission categories through chat providers', async () => {
      const user = userEvent.setup();
      const captured = renderSettingsPanel();

      await user.click(screen.getByRole('tab', { name: /behavior/i }));
      await user.click(screen.getByRole('button', { name: 'System' }));
      const readPermission = await screen.findByRole('group', { name: 'Read permission' });
      await user.click(within(readPermission).getByRole('button', { name: 'Allow' }));

      await waitFor(() => expect(captured.stateUpdates).toContainEqual({ notifications: 'system' }));
      await waitFor(() => expect(captured.permissions).toContainEqual({ category: 'read', policy: 'allow' }));
    });
  });
});
