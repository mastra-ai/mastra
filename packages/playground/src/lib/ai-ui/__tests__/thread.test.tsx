import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { TaskItem } from '@mastra/core/harness';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatProvider } from '../chat/chat-provider';
import { Thread } from '../thread';
import { memoryDisabled, memoryEnabled, v2Agent } from './fixtures/agent';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { ThreadInputProvider } from '@/domains/conversation';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type CapturedBody = Record<string, unknown>;

interface Captured {
  url: string;
  body: CapturedBody;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const captureBody = async (request: Request): Promise<CapturedBody> => {
  const body: unknown = await request.json();
  return isRecord(body) ? body : {};
};

const finishStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`));
      controller.close();
    },
  });

const sseResponse = () =>
  new HttpResponse(finishStream(), { status: 200, headers: { 'content-type': 'text/event-stream' } });

const workingMemoryResponse = () =>
  HttpResponse.json({ workingMemory: null, source: 'thread', workingMemoryTemplate: null, threadExists: false });

const baseHandlers = () => [
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
  http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
  http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
  http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => workingMemoryResponse()),
  http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
  http.get(`${BASE_URL}/api/agents/:agentId/voice/speakers`, () => HttpResponse.json([])),
  http.get(`${BASE_URL}/api/agents/:agentId`, () => HttpResponse.json(v2Agent)),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
    HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
  ),
  http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
  http.post(
    `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
    () =>
      new HttpResponse(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
  ),
];

const Wrapper = ({ children, threadId = 'thread-1' }: { children: ReactNode; threadId?: string }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BrowserSessionProvider agentId="agent-1" threadId={threadId} enabled={false}>
            <WorkingMemoryProvider agentId="agent-1" threadId={threadId} resourceId="agent-1">
              {children}
            </WorkingMemoryProvider>
          </BrowserSessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderThreadTree = (
  initialMessages: MastraDBMessage[],
  options: { hasModelList?: boolean; threadId?: string } = {},
) => {
  const { hasModelList = true, threadId = 'thread-1' } = options;

  return (
    <Wrapper threadId={threadId}>
      <ThreadInputProvider>
        <ChatProvider
          key={threadId}
          agentId="agent-1"
          threadId={threadId}
          initialMessages={initialMessages}
          supportsMemory={true}
          settings={{ modelSettings: { chatWithLegacyStream: false } }}
        >
          <Thread agentId="agent-1" agentName="Helper" threadId={threadId} hasModelList={hasModelList} />
        </ChatProvider>
      </ThreadInputProvider>
    </Wrapper>
  );
};

const renderThread = (
  initialMessages: MastraDBMessage[],
  options: { hasModelList?: boolean; threadId?: string } = { hasModelList: true },
) => render(renderThreadTree(initialMessages, options));

const userMessage = (text: string): MastraDBMessage => ({
  id: `m-${text}`,
  role: 'user',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }] },
});

const assistantMessage = (text: string, metadata?: MastraDBMessage['content']['metadata']): MastraDBMessage => ({
  id: `a-${text}`,
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }], metadata },
});

afterEach(() => {
  delete (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS;
  cleanup();
});

describe('Thread', () => {
  beforeEach(() => {
    (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'false';
    server.resetHandlers();
  });

  it('shows the empty welcome state when there are no messages', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread([]);
    });

    expect(screen.getByText('How can I help you today?')).toBeTruthy();
  });

  it('renders existing messages instead of the welcome state', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread([userMessage('previous question')]);
    });

    expect(screen.getByText('previous question')).toBeTruthy();
    expect(screen.queryByText('How can I help you today?')).toBeFalsy();
  });

  it('shows assistant model attribution when model-list metadata is available', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread([
        assistantMessage('model-list answer', {
          custom: { modelMetadata: { modelProvider: 'openai', modelId: 'gpt-4o-mini' } },
        }),
      ]);
    });

    expect(screen.getByText('model-list answer')).toBeTruthy();
    expect(screen.getByText('openai/gpt-4o-mini')).toBeTruthy();
  });

  it('hides assistant model attribution outside model-list mode', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread(
        [
          assistantMessage('single-model answer', {
            custom: { modelMetadata: { modelProvider: 'openai', modelId: 'gpt-4o-mini' } },
          }),
        ],
        { hasModelList: false },
      );
    });

    expect(screen.getByText('single-model answer')).toBeTruthy();
    expect(screen.queryByText('openai/gpt-4o-mini')).toBeFalsy();
  });

  it('sends the composer text through the agent stream endpoint', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'hello from composer' } });
    });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    expect(captured).toHaveLength(1);
    expect(JSON.stringify(captured[0].body.messages ?? [])).toContain('hello from composer');
    // Composer clears after sending.
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('restores unsent composer drafts when switching threads', async () => {
    server.use(...baseHandlers());

    let rendered: ReturnType<typeof render> | undefined;
    await act(async () => {
      rendered = render(renderThreadTree([], { threadId: 'thread-1' }));
    });

    const firstThreadTextarea = screen.getByPlaceholderText('Enter your message...') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(firstThreadTextarea, { target: { value: 'first thread draft' } });
    });
    expect(firstThreadTextarea.value).toBe('first thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-2' }));
    });

    const secondThreadTextarea = screen.getByPlaceholderText('Enter your message...') as HTMLTextAreaElement;
    expect(secondThreadTextarea.value).toBe('');

    await act(async () => {
      fireEvent.change(secondThreadTextarea, { target: { value: 'second thread draft' } });
    });
    expect(secondThreadTextarea.value).toBe('second thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-1' }));
    });

    expect((screen.getByPlaceholderText('Enter your message...') as HTMLTextAreaElement).value).toBe(
      'first thread draft',
    );

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-2' }));
    });

    expect((screen.getByPlaceholderText('Enter your message...') as HTMLTextAreaElement).value).toBe(
      'second thread draft',
    );
  });

  it('does not send when the composer is empty', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText('Enter your message...');
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(captured).toHaveLength(0);
  });

  it('attaches a URL from the popover without sending the chat message', async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
      http.head(
        'https://files.example.com/pic.png',
        () => new HttpResponse(null, { status: 200, headers: { 'content-type': 'image/png' } }),
      ),
    );

    await act(async () => {
      renderThread([]);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
    });

    const urlInput = await screen.findByLabelText('Public URL');
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://files.example.com/pic.png' } });
    });

    await act(async () => {
      fireEvent.submit(urlInput.closest('form') as HTMLFormElement);
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    // The attachment chip row appears and the popover closes.
    await waitFor(() => {
      expect(document.querySelector('[data-attachments-row]')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Public URL')).toBeFalsy();
    });
    // Submitting the popover form must not bubble into the composer form and send a chat message.
    expect(captured).toHaveLength(0);
  });

  it('shows a cancel control while a run is in flight', async () => {
    let resolveStream: (() => void) | null = null;
    const blockedStream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          // Keep the stream open until the test resolves it, so `isRunning` stays true.
          resolveStream = () => controller.close();
        },
      });

    server.use(
      ...baseHandlers(),
      http.post(
        `${BASE_URL}/api/agents/agent-1/stream`,
        () => new HttpResponse(blockedStream(), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      ),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'long running' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
    });

    await act(async () => {
      resolveStream?.();
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });
});

const sseChunk = (chunk: unknown) => `data: ${JSON.stringify(chunk)}\n\n`;

const taskSignalChunk = (tasks: TaskItem[], tagName = 'current-task-list') =>
  sseChunk({
    type: 'data-signal',
    data: {
      id: 'tasks',
      type: 'state',
      tagName,
      metadata: { value: { tasks } },
    },
  });

const taskPlanMenu: TaskItem = {
  id: 'task-plan-menu',
  content: 'Plan menu',
  status: 'in_progress',
  activeForm: 'Planning menu',
};

const taskShop: TaskItem = {
  id: 'task-shop',
  content: 'Create shopping list',
  status: 'pending',
  activeForm: 'Creating shopping list',
};

const taskCook: TaskItem = {
  id: 'task-cook',
  content: 'Cook meal',
  status: 'pending',
  activeForm: 'Cooking meal',
};

describe('TaskPanel', () => {
  beforeEach(() => {
    (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'true';
    server.resetHandlers();
  });

  const renderWithControlledSubscription = async () => {
    let subscribeController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();
    const subscribeStream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          subscribeController = controller;
        },
      });

    server.use(...baseHandlers());
    server.use(
      http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryEnabled)),
      http.post(
        `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
        () =>
          new HttpResponse(subscribeStream(), {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
      http.post(`${BASE_URL}/api/agents/agent-1/send-message`, () =>
        HttpResponse.json({ accepted: true, runId: 'run-1', signal: { id: 'task-signal-id' } }),
      ),
    );

    await act(async () => {
      renderThread([]);
    });

    const textarea = screen.getByPlaceholderText('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'track these tasks' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(subscribeController).toBeTruthy();
    });

    const pushTasks = async (tasks: TaskItem[], tagName = 'current-task-list') => {
      await act(async () => {
        subscribeController?.enqueue(encoder.encode(taskSignalChunk(tasks, tagName)));
      });
    };

    const close = async () => {
      await act(async () => {
        subscribeController?.close();
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    };

    return { pushTasks, close };
  };

  it('renders task items when a data-signal task snapshot streams in', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();

    await pushTasks([taskPlanMenu, taskShop, taskCook]);

    expect(await screen.findByTestId('task-panel')).toBeTruthy();
    expect(screen.getByText('0/3 completed')).toBeTruthy();
    expect(screen.getByText('Planning menu')).toBeTruthy();
    expect(screen.getByText('Create shopping list')).toBeTruthy();
    expect(screen.getByText('Cook meal')).toBeTruthy();

    await close();
  });

  it('updates the task list when a task-list-update delta streams in', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();
    const completedPlan: TaskItem = { ...taskPlanMenu, status: 'completed' };
    const activeShop: TaskItem = { ...taskShop, status: 'in_progress', activeForm: 'Shopping for ingredients' };

    await pushTasks([taskPlanMenu, taskShop]);
    await pushTasks([completedPlan, activeShop], 'task-list-update');

    expect(await screen.findByText('1/2 completed')).toBeTruthy();
    expect(screen.getByText('Plan menu')).toBeTruthy();
    expect(screen.getByText('Shopping for ingredients')).toBeTruthy();
    expect(screen.queryByText('Planning menu')).toBeFalsy();

    await close();
  });

  it('scrolls the active task into view when task state updates', async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    const { pushTasks, close } = await renderWithControlledSubscription();

    try {
      const activeShop: TaskItem = { ...taskShop, status: 'in_progress', activeForm: 'Shopping for ingredients' };

      await pushTasks([taskPlanMenu, activeShop, taskCook], 'task-list-update');

      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
      await close();
    }
  });

  it('hides when all tasks are complete', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();

    await pushTasks([
      { ...taskPlanMenu, status: 'completed' },
      { ...taskShop, status: 'completed' },
    ]);

    await waitFor(() => {
      expect(screen.queryByTestId('task-panel')).toBeFalsy();
    });

    await close();
  });

  it('hides when task_write clears tasks', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();

    await pushTasks([taskPlanMenu]);
    expect(await screen.findByTestId('task-panel')).toBeTruthy();

    await pushTasks([]);

    await waitFor(() => {
      expect(screen.queryByTestId('task-panel')).toBeFalsy();
    });

    await close();
  });
});

describe('Thread signal-path user-message reconciliation', () => {
  beforeEach(() => {
    (window as Window & { MASTRA_AGENT_SIGNALS?: string }).MASTRA_AGENT_SIGNALS = 'true';
    server.resetHandlers();
  });

  it('keeps the same user-row DOM node when the data-user-message echo swaps the message id', async () => {
    // A subscribe stream we control so we can push the server echo on demand.
    let subscribeController: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();
    const subscribeStream = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          subscribeController = controller;
        },
      });

    let capturedClientMessageId: string | undefined;
    const serverSignalId = 'server-signal-id';

    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'user-1' })),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
      http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
        HttpResponse.json({
          workingMemory: null,
          source: 'thread',
          workingMemoryTemplate: null,
          threadExists: false,
        }),
      ),
      http.get(`${BASE_URL}/api/agents/:agentId/voice/speakers`, () => HttpResponse.json([])),
      http.post(
        `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
        () =>
          new HttpResponse(subscribeStream(), {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      ),
      http.post(`${BASE_URL}/api/agents/agent-1/send-message`, async ({ request }) => {
        const body = (await request.json()) as {
          message?: { metadata?: { clientMessageId?: string } };
        };
        capturedClientMessageId = body.message?.metadata?.clientMessageId;
        return HttpResponse.json({ accepted: true, runId: 'run-1', signal: { id: serverSignalId } });
      }),
    );

    await act(async () => {
      renderThread([]);
    });

    // Let the mount-time thread subscription establish.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const textarea = screen.getByPlaceholderText('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'echo reconciliation' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    // The optimistic pending bubble is rendered. Capture its DOM node and the
    // client-generated correlation id sent to the server.
    const userRow = await waitFor(() => {
      const el = document.querySelector('[data-message-pending="true"]');
      if (!el) throw new Error('pending user row not yet rendered');
      return el as HTMLElement;
    });
    expect(capturedClientMessageId).toBeTruthy();
    const optimisticId = userRow.getAttribute('data-message-id');
    expect(optimisticId).toBeTruthy();
    expect(optimisticId).not.toBe(serverSignalId);

    // Push the server echo carrying the same clientMessageId but a new signal id.
    await act(async () => {
      subscribeController?.enqueue(
        encoder.encode(
          sseChunk({
            type: 'data-user-message',
            data: {
              type: 'user-message',
              id: serverSignalId,
              metadata: { clientMessageId: capturedClientMessageId },
            },
          }),
        ),
      );
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // The row must be updated in place (same node instance), not remounted:
    // its data-message-id now reflects the server id and the pending styling is gone.
    await waitFor(() => {
      expect(userRow.getAttribute('data-message-id')).toBe(serverSignalId);
    });
    expect(userRow.isConnected).toBe(true);
    expect(userRow.getAttribute('data-message-pending')).toBeNull();
    // Still exactly one user bubble for this turn (no duplicate from reconciliation).
    expect(screen.getByText('echo reconciliation')).toBeTruthy();

    await act(async () => {
      subscribeController?.close();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });
});
