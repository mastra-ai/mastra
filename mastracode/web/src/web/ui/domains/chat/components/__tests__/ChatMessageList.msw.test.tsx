/**
 * BDD coverage for `ChatMessageList` (`domains/chat/components`).
 *
 * The component owns the scrollable chat column: goal panel, connection
 * notice, empty-thread state, transcript entries, and the working indicator.
 * Driven end-to-end: real fetch/SSE transport, MSW at the network boundary.
 */
import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_CODE } from '../../../../../../shared/desktop-host';
import { OverlaysProvider } from '../../../../lib/overlays';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider } from '../../../workspaces';
import { loadProjects } from '../../../workspaces/services/projects';
import { ChatSessionProvider } from '../../context/ChatSessionProvider';
import { ChatMessageList } from '../ChatMessageList';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

afterEach(() => {
  localStorage.clear();
  delete window.mastracodeDesktop;
});

function seedProject() {
  const project: Project = {
    id: 'project-test',
    name: 'MastraCode Test',
    path: '/tmp/mastracode-test',
    resourceId: RESOURCE_ID,
    gitBranch: 'main',
    createdAt: 1,
  };
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
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
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse(events)),
  );
}

function renderMessageList() {
  // Mounted on the thread's own page: /chat is the draft composer and hides
  // the bound thread's transcript.
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <OverlaysProvider>
              <ActiveProjectProvider>
                <ChatSessionProvider>
                  <ChatMessageList />
                </ChatSessionProvider>
              </ActiveProjectProvider>
            </OverlaysProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChatMessageList', () => {
  it('given an empty thread, then it shows the welcome state with the project metadata', async () => {
    seedProject();
    useAgentControllerHandlers();
    renderMessageList();

    await waitFor(() => expect(screen.getByText('Ready for new conversation')).toBeInTheDocument());
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('MastraCode Test')).toBeInTheDocument();
    expect(screen.getByText('Resource ID')).toBeInTheDocument();
    expect(screen.getByText(RESOURCE_ID)).toBeInTheDocument();
    expect(screen.getByText('Branch')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('/tmp/mastracode-test')).toBeInTheDocument();
  });

  it('given streamed assistant text, then it renders the transcript entry', async () => {
    seedProject();
    useAgentControllerHandlers([
      { type: 'agent_start' },
      {
        type: 'message_update',
        message: { id: 'assistant-1', role: 'assistant', content: [{ type: 'text', text: 'Hello from the agent' }] },
      },
      { type: 'agent_end' },
    ]);
    renderMessageList();

    await waitFor(() => expect(screen.getByText('Hello from the agent')).toBeInTheDocument());
  });

  it('given a running turn without streamed assistant text, then it shows the working indicator', async () => {
    seedProject();
    useAgentControllerHandlers([{ type: 'agent_start' }]);
    renderMessageList();

    await waitFor(() => expect(screen.getByLabelText('Agent is working')).toBeInTheDocument());
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });

  it('given the selected model rejects its credentials, then it shows actionable recovery controls', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'error',
        error: 'undefined: The security token included in the request is invalid.' as unknown as Error,
      },
    ]);
    renderMessageList();

    expect(await screen.findByText('The security token included in the request is invalid.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose model' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('given the session fails to connect, then it shows the actual server error', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(http.post(`${API}/sessions`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderMessageList();

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('given a persisted desktop project needs approval, then Finder approval reconnects without duplicating it', async () => {
    seedProject();
    useAgentControllerHandlers();
    let approved = false;
    const selectProjectDirectory = vi.fn(async () => {
      approved = true;
      return { canceled: false, path: '/tmp/mastracode-test', name: 'mastracode-test' };
    });
    window.mastracodeDesktop = {
      getAppInfo: vi.fn(async () => ({
        name: 'MastraCode Desktop Alpha',
        version: 'test',
        platform: 'darwin' as const,
      })),
      selectProjectDirectory,
    };
    server.use(
      http.post(`${API}/sessions`, () =>
        approved
          ? HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID })
          : HttpResponse.json(
              {
                code: MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_CODE,
                error: 'Project path has not been approved by the desktop app',
              },
              { status: 403 },
            ),
      ),
      http.get(`${TEST_BASE_URL}/web/project/resolve`, () =>
        HttpResponse.json({
          resourceId: RESOURCE_ID,
          name: 'MastraCode Test',
          rootPath: '/tmp/mastracode-test',
          gitBranch: 'main',
        }),
      ),
    );
    const user = userEvent.setup();
    renderMessageList();

    await user.click(await screen.findByRole('button', { name: 'Allow folder access' }));
    await waitFor(() => expect(screen.getByText('Ready for new conversation')).toBeInTheDocument());

    expect(selectProjectDirectory).toHaveBeenCalledWith({ defaultPath: '/tmp/mastracode-test' });
    expect(loadProjects()).toHaveLength(1);
  });

  it('given a goal evaluation event, then it shows the goal panel with objective and progress', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'goal_evaluation',
        payload: { objective: 'Ship the refactor', status: 'active', iteration: 1, maxRuns: 5, passed: false },
      },
    ]);
    renderMessageList();

    await waitFor(() => expect(screen.getByText('Ship the refactor')).toBeInTheDocument());
    expect(screen.getByText('1/5')).toBeInTheDocument();
  });
});
