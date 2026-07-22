/**
 * BDD coverage for `ComposerPanel` at its domain boundary.
 * The harness supplies the chat session and command contexts that the panel consumes.
 */
import type { AgentControllerSessionState } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Factory } from '../../../workspaces';
import { ActiveFactoryProvider } from '../../../workspaces';
import { ChatCommandsProvider } from '../../context/ChatCommandsProvider';
import { ComposerPanel } from '../ComposerPanel';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

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
      gitBranch: 'main',
    },
  };
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
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

function useAgentControllerHandlers() {
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
    http.get(
      `${SESSION}/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
  );
}

function renderComposerPanel(composerVariant: 'inline' | 'textarea' = 'inline') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/project-test/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/threads/:threadId"
          element={
            <ActiveFactoryProvider factoryId="project-test">
              <ChatSessionProvider>
                <ChatCommandsProvider>
                  <ComposerPanel composerVariant={composerVariant} />
                </ChatCommandsProvider>
              </ChatSessionProvider>
            </ActiveFactoryProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ComposerPanel', () => {
  it('renders the textarea composer and preserves its draft', async () => {
    seedFactory();
    useAgentControllerHandlers();
    const user = userEvent.setup();
    renderComposerPanel('textarea');

    const message = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(message).toBeEnabled());
    await user.type(message, 'Keep this draft');

    expect(message).toHaveValue('Keep this draft');
  });

  it('renders the session mode and model status alongside the composer', async () => {
    seedFactory();
    useAgentControllerHandlers();
    renderComposerPanel();

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled());
    expect(screen.getByText('build')).toBeInTheDocument();
    expect(await screen.findByText(/GPT-4o Mini/)).toBeInTheDocument();
  });
});
