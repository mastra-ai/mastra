/**
 * BDD coverage for `useGlobalShortcuts` (`domains/chat/hooks`).
 *
 * The hook is now zero-args: it observes `useOverlays()`,
 * `useChatTranscript()` (busy + abort), and `useActiveFactoryContext()` (zero
 * factories disable the Escape cascade during onboarding) directly. Specs
 * preserve the `?` shortcuts toggle unless typing, and the Escape priority
 * cascade.
 */
import type { AgentControllerEvent } from '@mastra/client-js';
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { OverlayName } from '../../../../lib/overlays';
import { OverlaysProvider, useOverlays } from '../../../../lib/overlays';
import type { Factory } from '../../../workspaces';
import { ActiveFactoryProvider } from '../../../workspaces';
import { useChatConnection } from '../../context/useChatConnection';
import { useChatTranscript } from '../../context/useChatTranscript';
import { useGlobalShortcuts } from '../useGlobalShortcuts';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

const OVERLAYS: OverlayName[] = ['sidebar', 'settings', 'shortcuts'];

afterEach(() => {
  localStorage.clear();
});

function seedFactory() {
  const project: Factory = {
    id: 'project-test',
    name: 'MastraCode Test',
    resourceId: RESOURCE_ID,
    createdAt: 1,
    binding: {
      kind: 'local',
      path: '/tmp/mastracode-test',
    },
  };
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-factory', project.id);
}

function sse(events: AgentControllerEvent[] = []): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      },
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function useAgentControllerHandlers(events: AgentControllerEvent[] = []) {
  const sessionState = {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', name: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState)),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState)),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse(events)),
  );
}

function Probe() {
  useGlobalShortcuts();
  const overlays = useOverlays();
  const { status } = useChatConnection();
  const { busy } = useChatTranscript();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="busy">{busy ? 'yes' : 'no'}</span>
      {OVERLAYS.map(name => (
        <span key={name} data-testid={`overlay-${name}`}>
          {overlays.isOpen(name) ? 'open' : 'closed'}
        </span>
      ))}
      {OVERLAYS.map(name => (
        <button key={name} onClick={() => overlays.open(name)}>
          open {name}
        </button>
      ))}
      <input aria-label="composer" />
    </div>
  );
}

function renderProbe(threadId?: string) {
  return renderWithProviders(
    <MainSidebarProvider storageKey="global-shortcuts-test" mobileBreakpoint={768}>
      <ActiveFactoryProvider>
        <ChatSessionProvider threadId={threadId}>
          <OverlaysProvider>
            <Probe />
          </OverlaysProvider>
        </ChatSessionProvider>
      </ActiveFactoryProvider>
    </MainSidebarProvider>,
  );
}

function expectOverlay(name: OverlayName, state: 'open' | 'closed') {
  expect(screen.getByTestId(`overlay-${name}`)).toHaveTextContent(state);
}

async function ready() {
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
}

describe('useGlobalShortcuts', () => {
  it('given focus is not in a text field, when ? is pressed, then the shortcuts overlay toggles', async () => {
    seedFactory();
    useAgentControllerHandlers();
    renderProbe(THREAD_ID);
    await ready();

    await userEvent.keyboard('?');
    expectOverlay('shortcuts', 'open');
    await userEvent.keyboard('?');
    expectOverlay('shortcuts', 'closed');
  });

  it('given focus is in a text field, when ? is typed, then the shortcuts overlay stays closed', async () => {
    seedFactory();
    useAgentControllerHandlers();
    renderProbe(THREAD_ID);
    await ready();

    await userEvent.type(screen.getByLabelText('composer'), '?');
    expectOverlay('shortcuts', 'closed');
  });

  it('given Cmd/Ctrl+K is pressed, when a retained overlay is open, then it stays open', async () => {
    seedFactory();
    useAgentControllerHandlers();
    renderProbe(THREAD_ID);
    await ready();

    await userEvent.click(screen.getByRole('button', { name: 'open settings' }));
    await userEvent.keyboard('{Control>}k{/Control}');

    expectOverlay('settings', 'open');
  });

  it('given several overlays are open, when Escape is pressed repeatedly, then they close in priority order shortcuts → settings → sidebar', async () => {
    seedFactory();
    useAgentControllerHandlers();
    renderProbe(THREAD_ID);
    await ready();

    for (const name of ['sidebar', 'settings', 'shortcuts'] as const) {
      await userEvent.click(screen.getByRole('button', { name: `open ${name}` }));
    }

    await userEvent.keyboard('{Escape}');
    expectOverlay('shortcuts', 'closed');
    expectOverlay('settings', 'open');

    await userEvent.keyboard('{Escape}');
    expectOverlay('settings', 'closed');
    expectOverlay('sidebar', 'open');

    await userEvent.keyboard('{Escape}');
    expectOverlay('sidebar', 'closed');
  });

  it('given zero factories (onboarding), when Escape is pressed, then it is a no-op even with overlays open', async () => {
    // No seedFactory(): the Escape cascade is disabled during onboarding.
    useAgentControllerHandlers();
    renderProbe(undefined);

    await userEvent.click(screen.getByRole('button', { name: 'open settings' }));
    await userEvent.keyboard('{Escape}');
    expectOverlay('settings', 'open');
  });

  it('given a running turn and no open overlays, when Escape is pressed, then the run is aborted', async () => {
    seedFactory();
    useAgentControllerHandlers([{ type: 'agent_start' }]);
    let aborted = false;
    server.use(
      http.post(`${SESSION}/abort`, () => {
        aborted = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderProbe(THREAD_ID);
    await waitFor(() => expect(screen.getByTestId('busy')).toHaveTextContent('yes'));

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(aborted).toBe(true));
  });
});
