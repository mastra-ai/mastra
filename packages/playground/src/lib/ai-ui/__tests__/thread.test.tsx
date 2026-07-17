import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { TaskItem } from '@mastra/core/signals';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatProvider } from '../chat/chat-provider';
import { Thread } from '../thread';
import { memoryDisabled, memoryEnabled, v2Agent } from './fixtures/agent';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { ThreadInputProvider } from '@/domains/conversation';
import { server } from '@/test/msw-server';

declare global {
  interface Window {
    MASTRA_AGENT_SIGNALS?: string;
  }
}

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
  // Drive the real memory hooks; the sidebar consumers aren't rendered here, so empty payloads suffice.
  http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
  http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json({ record: null })),
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

const userMessageWithFiles = (text: string, filenames: string[]): MastraDBMessage => ({
  id: `m-${text}`,
  role: 'user',
  createdAt: new Date(),
  content: {
    format: 2,
    parts: [
      { type: 'text', text },
      ...filenames.map(filename => ({
        type: 'file' as const,
        filename,
        mimeType: 'application/pdf',
        data: `https://files.example.com/${filename}`,
      })),
    ],
  },
});

const assistantMessage = (text: string, metadata?: MastraDBMessage['content']['metadata']): MastraDBMessage => ({
  id: `a-${text}`,
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text }], metadata },
});

afterEach(() => {
  delete window.MASTRA_AGENT_SIGNALS;
  cleanup();
});

describe('Thread', () => {
  beforeEach(() => {
    window.MASTRA_AGENT_SIGNALS = 'false';
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

    expect(screen.getByText('previous question', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText('How can I help you today?')).toBeFalsy();
  });

  describe('when rendering the thread rail', () => {
    it('does not render for the empty welcome state', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([]);
      });

      expect(screen.queryByTestId('thread-rail')).toBeFalsy();
    });

    it('renders one tick per user turn with preview labels and the latest turn marked in view', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([
          userMessageWithFiles('first question', ['plan.md', 'notes.pdf', 'trace.json']),
          assistantMessage('first answer'),
          userMessage('second question'),
        ]);
      });

      expect(screen.getByRole('navigation', { name: 'Conversation timeline' })).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /Jump to/ })).toHaveLength(2);
      const rail = screen.getByTestId('thread-rail');
      expect(screen.getByTestId('thread-rail-container').className).toContain('thread-rail-container');
      expect(screen.getByTestId('thread-rail-layer').className).toContain('thread-rail-layer');
      expect(screen.getByTestId('thread-rail-layer').className).toContain('left-4');
      expect(screen.getByTestId('thread-rail-layer').className).not.toContain('xl:block');
      expect(screen.getByTestId('thread-rail-scroll-area')).toBeTruthy();
      expect(screen.getByTestId('thread-message-column').contains(rail)).toBe(false);

      const firstTurn = screen.getByRole('button', { name: 'Jump to first question' });
      const secondTurn = screen.getByRole('button', { name: 'Jump to second question' });

      fireEvent.mouseEnter(firstTurn);

      const previewCurrent = within(screen.getByTestId('thread-rail-preview-current'));
      expect(previewCurrent.getByText('first answer')).toBeTruthy();
      expect(previewCurrent.getByText('plan.md')).toBeTruthy();
      expect(previewCurrent.getByText('notes.pdf')).toBeTruthy();
      expect(previewCurrent.getByText('+1')).toBeTruthy();

      expect(firstTurn.getAttribute('aria-current')).toBeNull();
      expect(firstTurn.getAttribute('data-in-view')).toBeNull();
      expect(secondTurn.getAttribute('aria-current')).toBe('location');
      expect(secondTurn.getAttribute('data-in-view')).toBe('true');
      expect(secondTurn.getAttribute('data-active')).toBe('true');
    });

    it('scrolls to the selected user message', async () => {
      const scrollTo = vi.fn();
      const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        writable: true,
        value: scrollTo,
      });
      server.use(...baseHandlers());

      try {
        await act(async () => {
          renderThread([
            userMessage('first question'),
            assistantMessage('first answer'),
            userMessage('second question'),
          ]);
        });

        const viewport = document.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
        if (!viewport) throw new Error('missing message scroller viewport');
        Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 20 });
        Object.defineProperty(viewport, 'getBoundingClientRect', {
          configurable: true,
          value: vi.fn(() => ({
            top: 0,
            bottom: 40,
            left: 0,
            right: 100,
            width: 100,
            height: 40,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          })),
        });
        const firstMessage = document.querySelector<HTMLElement>('[data-message-id="m-first question"]');
        if (!firstMessage) throw new Error('missing first message scroller item');
        Object.defineProperty(firstMessage, 'getBoundingClientRect', {
          configurable: true,
          value: vi.fn(() => ({
            top: -20,
            bottom: 20,
            left: 0,
            right: 100,
            width: 100,
            height: 40,
            x: 0,
            y: -20,
            toJSON: () => ({}),
          })),
        });

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Jump to first question' }));
        });

        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalDescriptor);
        } else {
          delete HTMLElement.prototype.scrollTo;
        }
      }
    });

    it('shows a scroll-to-bottom control when the viewport is not at the bottom', async () => {
      const scrollTo = vi.fn();
      const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        writable: true,
        value: scrollTo,
      });
      server.use(...baseHandlers());

      try {
        await act(async () => {
          renderThread([
            userMessage('first question'),
            assistantMessage('first answer'),
            userMessage('second question'),
          ]);
        });

        const viewport = document.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
        if (!viewport) throw new Error('missing message scroller viewport');

        Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 40 });
        Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 100 });
        Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 320 });

        const scrollToEnd = screen.getByRole('button', { name: 'Scroll to end' });
        expect(scrollToEnd.getAttribute('data-active')).toBe('false');

        await act(async () => {
          fireEvent.scroll(viewport);
        });

        await waitFor(() => {
          expect(scrollToEnd.getAttribute('data-active')).toBe('true');
        });

        await act(async () => {
          fireEvent.click(scrollToEnd);
        });

        expect(scrollTo).toHaveBeenCalledWith({ top: 220, behavior: 'smooth' });
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalDescriptor);
        } else {
          delete HTMLElement.prototype.scrollTo;
        }
      }
    });
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
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
    expect(textarea.value).toBe('');
  });

  it('restores unsent composer drafts when switching threads', async () => {
    server.use(...baseHandlers());

    let rendered: ReturnType<typeof render> | undefined;
    await act(async () => {
      rendered = render(renderThreadTree([], { threadId: 'thread-1' }));
    });

    const firstThreadTextarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    await act(async () => {
      fireEvent.change(firstThreadTextarea, { target: { value: 'first thread draft' } });
    });
    expect(firstThreadTextarea.value).toBe('first thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-2' }));
    });

    const secondThreadTextarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    expect(secondThreadTextarea.value).toBe('');

    await act(async () => {
      fireEvent.change(secondThreadTextarea, { target: { value: 'second thread draft' } });
    });
    expect(secondThreadTextarea.value).toBe('second thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-1' }));
    });

    expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...').value).toBe('first thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-2' }));
    });

    expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...').value).toBe('second thread draft');
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(captured).toHaveLength(0);
  });

  describe('when Enter is pressed during IME composition', () => {
    it('does not send the partial message', async () => {
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

      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'composing text' } });
        fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(captured).toHaveLength(0);
    });
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

    const composerForm = urlInput.closest<HTMLFormElement>('form');
    if (!composerForm) throw new Error('composer form not found');
    await act(async () => {
      fireEvent.submit(composerForm);
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
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
    window.MASTRA_AGENT_SIGNALS = 'true';
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
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
    window.MASTRA_AGENT_SIGNALS = 'true';
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
        const body: { message?: { metadata?: { clientMessageId?: string } } } = await request.json();
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'echo reconciliation' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    // The optimistic pending bubble is rendered. Capture its DOM node and the
    // client-generated correlation id sent to the server.
    const userRow = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-message-pending="true"]');
      if (!el) throw new Error('pending user row not yet rendered');
      return el;
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
    expect(screen.getAllByText('echo reconciliation', { selector: 'p' })).toHaveLength(1);

    await act(async () => {
      subscribeController?.close();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });
});
