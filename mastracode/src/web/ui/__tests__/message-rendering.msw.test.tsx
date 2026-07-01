import type { AgentControllerEvent, AgentControllerMessage, AgentControllerSessionState } from '@mastra/client-js';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import App from '../App';
import type { Project } from '../projects';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const PROJECT_PATH = '/tmp/mastracode-test';

function seedProject() {
  const project: Project = {
    id: 'project-test',
    name: 'MastraCode Test',
    path: PROJECT_PATH,
    resourceId: RESOURCE_ID,
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

function delayedSse(event: AgentControllerEvent) {
  const encoder = new TextEncoder();
  let emit: () => void = () => {};
  let markReady: () => void = () => {};
  const ready = new Promise<void>(resolve => {
    markReady = resolve;
  });
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        emit = () => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        markReady();
      },
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
  return { response, emit: () => ready.then(() => emit()) };
}

function useAgentControllerHandlers({
  messages = [],
  events = [],
}: {
  messages?: AgentControllerMessage[];
  events?: AgentControllerEvent[];
} = {}) {
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages })),
    http.get(`${SESSION}/stream`, () => sse(events)),
  );
}

afterEach(() => localStorage.clear());

describe('MastraCode message rendering', () => {
  it('renders hydrated persisted text, thinking, and tool content through Mastra message parts', async () => {
    seedProject();
    useAgentControllerHandlers({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'text', text: '**Hello** from hydrate' },
            { type: 'thinking', thinking: 'checking files' },
            { type: 'tool_call', id: 'tool-1', name: 'view', args: { path: 'README.md' } },
            { type: 'tool_result', id: 'tool-1', name: 'view', result: 'readme contents' },
          ],
        },
      ],
    });

    renderWithProviders(<App />);

    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('from hydrate')).toBeInTheDocument();
    expect(screen.getByText('checking files')).toBeInTheDocument();
    const toolName = screen.getAllByText('view').find(node => node.closest('.tool-card'));
    if (!toolName) throw new Error('missing view tool card');
    const card = toolName.closest('.tool-card');
    if (!(card instanceof HTMLElement)) throw new Error('missing view tool card wrapper');
    expect(within(card).getByText('Done')).toBeInTheDocument();
  });

  it('renders assistant text when SSE message updates arrive after subscription', async () => {
    seedProject();
    const stream = delayedSse({
      type: 'message_update',
      message: { id: 'assistant-stream', role: 'assistant', content: [{ type: 'text', text: 'Streaming now' }] },
    });
    useAgentControllerHandlers();
    server.use(http.get(`${SESSION}/stream`, () => stream.response));

    renderWithProviders(<App />);

    expect(await screen.findByText('ready')).toBeInTheDocument();
    await stream.emit();

    expect(await screen.findByText('Streaming now')).toBeInTheDocument();
  });

  it('renders tool lifecycle events inline before a later message update re-emits the tool part', async () => {
    seedProject();
    useAgentControllerHandlers({
      events: [
        { type: 'tool_input_start', toolCallId: 'tool-live', toolName: 'execute_command' },
        {
          type: 'tool_input_delta',
          toolCallId: 'tool-live',
          argsTextDelta: '{"command":"pnpm test"}',
          toolName: 'execute_command',
        },
        { type: 'tool_start', toolCallId: 'tool-live', toolName: 'execute_command', args: { command: 'pnpm test' } },
        { type: 'shell_output', toolCallId: 'tool-live', output: 'passing tests', stream: 'stdout' },
        { type: 'tool_end', toolCallId: 'tool-live', result: 'ok' },
      ],
    });

    renderWithProviders(<App />);

    const toolName = await screen.findByText('execute_command');
    const card = toolName.closest('.tool-card');
    if (!(card instanceof HTMLElement)) throw new Error('missing tool card');
    expect(within(card).getByText('Done')).toBeInTheDocument();
    expect(within(card).getByText('passing tests')).toBeInTheDocument();
  });

  it('renders status metadata as status UI instead of raw JSON', async () => {
    seedProject();
    useAgentControllerHandlers({
      messages: [
        {
          id: 'assistant-status',
          role: 'assistant',
          content: [{ type: 'om_thread_title_updated', text: 'Thread title updated: Better title' }],
        },
      ],
    });

    renderWithProviders(<App />);

    expect(await screen.findByText('Thread title updated: Better title')).toBeInTheDocument();
    expect(screen.queryByText(/om_thread_title_updated/)).not.toBeInTheDocument();
  });
});
