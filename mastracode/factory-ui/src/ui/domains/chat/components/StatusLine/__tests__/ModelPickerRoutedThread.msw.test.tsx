import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/ui/render';
import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import { ChatPermissionsProvider } from '../../../context/ChatPermissionsProvider';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ChatSessionBoundary } from '../../../context/ChatSessionProvider';
import { AGENT_CONTROLLER_ID } from '../../../services/constants';
import { ModelPicker } from '../ModelPicker';

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const API = `${TEST_BASE_URL}/api/agent-controller/${AGENT_CONTROLLER_ID}`;
const RESOURCE_ID = 'resource-1';
const PRIMARY_THREAD_ID = 'primary-thread';
const WORK_THREAD_ID = 'work-thread';
const CHAT_THREAD_ID = 'chat-thread';

const models: AvailableModelOption[] = [
  { id: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', modelName: 'claude-sonnet-4-6', hasApiKey: true },
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true },
];

const session: ChatSessionContextApi = {
  resourceId: RESOURCE_ID,
  sessionThreadId: PRIMARY_THREAD_ID,
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  sandboxPreparing: false,
  resourceEnabled: true,
  factorySessionState: { factoryProjectId: 'fp-1' },
  baseUrl: TEST_BASE_URL,
  kind: 'factory',
};

/** Mirrors ThreadPage: the routed thread drives the boundary. */
function RoutedThread() {
  const { threadId } = useParams<{ threadId: string }>();
  return (
    <ChatSessionBoundary threadId={threadId} deferUntilMessagesReady={false}>
      <ModelPicker />
      <Link to={`/factories/fp-1/workspaces/${RESOURCE_ID}/threads/${WORK_THREAD_ID}`}>Open work thread</Link>
      <Link to={`/factories/fp-1/workspaces/${RESOURCE_ID}/threads/${CHAT_THREAD_ID}`}>Open chat thread</Link>
    </ChatSessionBoundary>
  );
}

function renderRoute(initialThreadId: string) {
  const requestedThreads: string[] = [];
  window.__MASTRACODE_CONFIG__ = { authEnabled: true };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { id: 'viewer-1', organizationId: 'org-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({
        project: {
          id: 'fp-1',
          name: 'Mastra',
          modelScope: 'hybrid',
          defaultModelId: 'openai/gpt-5',
          defaultThinkingLevel: 'medium',
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () => HttpResponse.json({ modelId: 'openai/gpt-5' })),
    // The server resolves the thread's owner and billing scope; a work-item thread is Factory-billed.
    http.get(`${TEST_BASE_URL}/web/config/models`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(params.get('resourceId')).toBe(RESOURCE_ID);
      const threadId = params.get('threadId') ?? '';
      requestedThreads.push(threadId);
      const factoryBilled = threadId === WORK_THREAD_ID;
      return HttpResponse.json({
        modelScope: factoryBilled ? 'factory' : 'user',
        defaultModelId: factoryBilled ? 'openai/gpt-5' : 'anthropic/claude-sonnet-4-6',
        models: models.filter(model => model.provider === (factoryBilled ? 'openai' : 'anthropic')),
      });
    }),
    http.post(`${API}/sessions`, () => HttpResponse.json({ resourceId: RESOURCE_ID, threadId: PRIMARY_THREAD_ID })),
    http.get(`${API}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: AGENT_CONTROLLER_ID,
        resourceId: RESOURCE_ID,
        modeId: 'build',
        modelId: 'openai/gpt-5',
      }),
    ),
    http.put(`${API}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${API}/sessions/:resourceId/stream`,
      () => new HttpResponse(new ReadableStream(), { headers: { 'Content-Type': 'text/event-stream' } }),
    ),
    http.get(`${API}/sessions/:resourceId/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
  );

  renderWithProviders(
    <ChatSessionContext.Provider value={session}>
      <ChatConnectionContext.Provider
        value={{
          status: 'ready',
          state: {
            controllerId: AGENT_CONTROLLER_ID,
            sessionId: RESOURCE_ID,
            resourceId: RESOURCE_ID,
            modeId: 'build',
            modelId: 'openai/gpt-5',
          },
        }}
      >
        <ChatPermissionsProvider>
          <MemoryRouter initialEntries={[`/factories/fp-1/workspaces/${RESOURCE_ID}/threads/${initialThreadId}`]}>
            <Routes>
              <Route path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId" element={<RoutedThread />} />
            </Routes>
          </MemoryRouter>
        </ChatPermissionsProvider>
        <Toaster position="bottom-right" />
      </ChatConnectionContext.Provider>
    </ChatSessionContext.Provider>,
  );
  return { requestedThreads };
}

async function expectWorkItemCatalog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Session model/ }));
  const option = await screen.findByRole('option', { name: /gpt-5/ });
  expect(within(option).getByText('Default')).toBeVisible();
  expect(screen.queryByRole('option', { name: /claude-sonnet-4-6/ })).not.toBeInTheDocument();
  expect(await screen.findByRole('note')).toHaveTextContent(
    "Showing models this Factory's organization credentials can run.",
  );
  await user.keyboard('{Escape}');
}

async function expectInteractiveCatalog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Session model/ }));
  const option = await screen.findByRole('option', { name: /claude-sonnet-4-6/ });
  expect(within(option).getByText('Default')).toBeVisible();
  expect(screen.queryByRole('option', { name: /gpt-5/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Showing models this Factory/)).not.toBeInTheDocument();
  await user.keyboard('{Escape}');
}

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

describe('ModelPicker on a routed thread', () => {
  it('follows the displayed work-item thread, not the session-primary thread, across navigation', async () => {
    const user = userEvent.setup();
    const { requestedThreads } = renderRoute(WORK_THREAD_ID);

    await expectWorkItemCatalog(user);
    await user.click(screen.getByRole('link', { name: 'Open chat thread' }));
    await expectInteractiveCatalog(user);

    await waitFor(() => expect([...new Set(requestedThreads)]).toEqual([WORK_THREAD_ID, CHAT_THREAD_ID]));
    expect(requestedThreads).not.toContain(PRIMARY_THREAD_ID);
    expect(requestedThreads).not.toContain(RESOURCE_ID);
  });

  it('follows the displayed interactive thread, then a work-item thread, in the same session', async () => {
    const user = userEvent.setup();
    const { requestedThreads } = renderRoute(CHAT_THREAD_ID);

    await expectInteractiveCatalog(user);
    await user.click(screen.getByRole('link', { name: 'Open work thread' }));
    await expectWorkItemCatalog(user);

    await waitFor(() => expect([...new Set(requestedThreads)]).toEqual([CHAT_THREAD_ID, WORK_THREAD_ID]));
    expect(requestedThreads).not.toContain(PRIMARY_THREAD_ID);
  });
});
