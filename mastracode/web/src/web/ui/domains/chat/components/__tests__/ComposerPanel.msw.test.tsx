/**
 * BDD coverage for the bottom chat and goal interaction surface.
 * Driven through the real chat providers and agent-controller HTTP boundary.
 */
import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider } from '../../../workspaces';
import { ChatSessionProvider } from '../../context/ChatSessionProvider';
import { ComposerPanel } from '../ComposerPanel';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

afterEach(() => {
  localStorage.clear();
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
    http.post(`${SESSION}/goal`, () => HttpResponse.json({})),
    http.put(`${SESSION}/goal`, () => HttpResponse.json({})),
    http.delete(`${SESSION}/goal`, () => HttpResponse.json({})),
    http.get(`${SESSION}/stream`, () => sse(events)),
  );
}

function renderComposerPanel(composerVariant: 'inline' | 'textarea' = 'inline') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ActiveProjectProvider>
              <ChatSessionProvider>
                <ComposerPanel composerVariant={composerVariant} />
              </ChatSessionProvider>
            </ActiveProjectProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ComposerPanel', () => {
  it('defaults to chat and preserves drafts while the textarea composer variant swaps views', async () => {
    seedProject();
    useAgentControllerHandlers();
    const user = userEvent.setup();
    renderComposerPanel('textarea');

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'Keep this draft');
    expect(message).toHaveValue('Keep this draft');
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Goal' }));
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument();
    const objective = screen.getByRole('textbox', { name: 'Goal objective' });
    expect(objective).toHaveAttribute('placeholder', 'Describe your goal…');
    await user.type(objective, 'Keep this objective');
    expect(objective).toHaveValue('Keep this objective');

    await user.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Keep this draft');

    await user.click(screen.getByRole('tab', { name: 'Goal' }));
    expect(screen.getByRole('textbox', { name: 'Goal objective' })).toHaveValue('Keep this objective');
  });

  it('sets a runtime goal from the goal view', async () => {
    seedProject();
    useAgentControllerHandlers();
    const requests: unknown[] = [];
    server.use(
      http.post(`${SESSION}/goal`, async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({});
      }),
      http.put(`${SESSION}/goal`, async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({});
      }),
      http.delete(`${SESSION}/goal`, () => {
        requests.push('clear');
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderComposerPanel();

    await user.click(await screen.findByRole('tab', { name: 'Goal' }));
    await user.type(screen.getByRole('textbox', { name: 'Goal objective' }), 'Ship the refactor');
    await user.click(screen.getByRole('button', { name: 'Set goal' }));
    await waitFor(() => expect(requests).toEqual([{ objective: 'Ship the refactor' }]));
  });

  it('pauses and clears an active goal from runtime events', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'goal_evaluation',
        payload: { objective: 'Ship the refactor', status: 'active', iteration: 1, maxRuns: 5, passed: false },
      },
    ]);
    const requests: unknown[] = [];
    server.use(
      http.put(`${SESSION}/goal`, async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({});
      }),
      http.delete(`${SESSION}/goal`, () => {
        requests.push('clear');
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderComposerPanel();

    await user.click(await screen.findByRole('tab', { name: 'Goal' }));
    expect(await screen.findByText('Ship the refactor')).toBeInTheDocument();
    expect(screen.getByText('1/5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(requests).toEqual([{ status: 'paused' }]));
    await user.click(screen.getByRole('button', { name: 'Clear goal' }));
    await waitFor(() => expect(requests).toEqual([{ status: 'paused' }, 'clear']));
  });

  it('resumes and clears a paused runtime goal', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'goal_evaluation',
        payload: { objective: 'Ship the refactor', status: 'paused', iteration: 2, maxRuns: 5, passed: false },
      },
    ]);
    const requests: unknown[] = [];
    server.use(
      http.put(`${SESSION}/goal`, async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({});
      }),
      http.delete(`${SESSION}/goal`, () => {
        requests.push('clear');
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderComposerPanel();

    await user.click(await screen.findByRole('tab', { name: 'Goal' }));
    expect(await screen.findByText('Ship the refactor')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(requests).toEqual([{ status: 'active' }]));
    await user.click(screen.getByRole('button', { name: 'Clear goal' }));
    await waitFor(() => expect(requests).toEqual([{ status: 'active' }, 'clear']));
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });
});
