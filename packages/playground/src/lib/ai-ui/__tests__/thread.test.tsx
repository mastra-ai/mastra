import { MastraClient } from '@mastra/client-js';
import type { ListMemoryThreadMessagesResponse, StreamParams } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { TaskItem } from '@mastra/core/signals';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatProvider } from '../chat/chat-provider';
import { Thread } from '../thread';
import { emptyChannelPlatforms, emptyMcpServers, memoryDisabled, memoryEnabled, v2Agent } from './fixtures/agent';
import { attachmentMessages } from './fixtures/attachment-messages';
import { abortedSignalRun, acceptedSignalMessage, signalRunStart } from './fixtures/signal-run';
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
  http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyChannelPlatforms)),
  http.get(`${BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json(emptyMcpServers)),
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

interface RenderThreadOptions {
  modelSettings?: NonNullable<ComponentProps<typeof ChatProvider>['settings']>['modelSettings'];
  hasModelList?: boolean;
  threadId?: string;
  suggestedPrompts?: string[];
  isHistoryLoading?: boolean;
  isLoadingPrevious?: boolean;
  onLoadPrevious?: () => void | Promise<void>;
}

const renderThreadTree = (initialMessages: MastraDBMessage[], options: RenderThreadOptions = {}) => {
  const {
    modelSettings,
    hasModelList = true,
    threadId = 'thread-1',
    suggestedPrompts,
    isHistoryLoading,
    isLoadingPrevious,
    onLoadPrevious,
  } = options;

  return (
    <Wrapper threadId={threadId}>
      <ThreadInputProvider>
        <ChatProvider
          key={threadId}
          agentId="agent-1"
          modelVersion={v2Agent.modelVersion}
          threadId={threadId}
          initialMessages={initialMessages}
          supportsMemory
          settings={{ modelSettings: { chatWithLegacyStream: false, ...modelSettings } }}
        >
          <Thread
            agentId="agent-1"
            agentName="Helper"
            threadId={threadId}
            suggestedPrompts={suggestedPrompts}
            hasModelList={hasModelList}
            isHistoryLoading={isHistoryLoading}
            isLoadingPrevious={isLoadingPrevious}
            onLoadPrevious={onLoadPrevious}
          />
        </ChatProvider>
      </ThreadInputProvider>
    </Wrapper>
  );
};

const renderThread = (initialMessages: MastraDBMessage[], options?: RenderThreadOptions) =>
  render(renderThreadTree(initialMessages, options));

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

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');

const installFakeRecorder = () => {
  class FakeMediaRecorder {
    static isTypeSupported() {
      return true;
    }
    state = 'inactive';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() {
      this.state = 'recording';
    }
    stop() {
      this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }) },
  });
};

afterEach(() => {
  delete window.MASTRA_AGENT_SIGNALS;
  delete window.MASTRA_PLATFORM_PROJECT_ID;
  vi.unstubAllGlobals();
  if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  else Reflect.deleteProperty(navigator, 'mediaDevices');
  if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
  else Reflect.deleteProperty(URL, 'createObjectURL');
  cleanup();
});

describe('Thread', () => {
  beforeEach(() => {
    window.MASTRA_AGENT_SIGNALS = 'false';
    server.resetHandlers();
  });

  describe('when Gateway audio is unavailable', () => {
    it('does not render Gateway speech controls', async () => {
      server.use(...baseHandlers());
      await act(async () => {
        renderThread([]);
      });
      expect(screen.queryByRole('button', { name: 'Start dictation' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Voice settings' })).toBeNull();
    });

    it('hides speech controls when the deployed user is denied access', async () => {
      window.MASTRA_PLATFORM_PROJECT_ID = 'project-1';
      const accessChecked = vi.fn();
      server.use(
        ...baseHandlers(),
        http.get(`${BASE_URL}/api/system/gateway-audio/models`, () => {
          accessChecked();
          return new HttpResponse(null, { status: 403 });
        }),
      );
      renderThread([]);

      await waitFor(() => expect(accessChecked).toHaveBeenCalledOnce());
      expect(screen.queryByRole('button', { name: 'Start dictation' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Voice settings' })).toBeNull();
    });
  });

  describe('when a deployed user has Gateway audio access', () => {
    beforeEach(() => {
      window.MASTRA_PLATFORM_PROJECT_ID = 'project-1';
      installFakeRecorder();
    });

    it('offers Gateway models and inserts dictated text into the composer', async () => {
      server.use(
        ...baseHandlers(),
        http.get(`${BASE_URL}/api/system/gateway-audio/models`, () =>
          HttpResponse.json({
            speech: [{ id: 'minimax/speech', voices: ['george'] }],
            transcription: [{ id: 'openai/whisper' }, { id: 'mistral/voxtral' }],
          }),
        ),
        http.post(`${BASE_URL}/api/system/gateway-audio/transcriptions`, async ({ request }) => {
          expect(await request.text()).toContain('mistral/voxtral');
          return HttpResponse.json({ text: 'spoken words' });
        }),
      );
      renderThread([assistantMessage('A reply')]);

      const modelSettings = await screen.findByRole('button', { name: 'Model settings' });
      expect(screen.queryByRole('button', { name: 'Voice settings' })).toBeNull();
      expect(screen.queryByRole('combobox', { name: 'Speech model' })).toBeNull();
      fireEvent.click(modelSettings);
      expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Speech model' }).value).toBe('minimax/speech');
      fireEvent.change(screen.getByRole('combobox', { name: 'Transcription model' }), {
        target: { value: 'mistral/voxtral' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Voice ID' }), { target: { value: 'sarah' } });
      expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Voice ID' }).value).toBe('sarah');
      fireEvent.click(screen.getByRole('button', { name: 'Start dictation' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Stop dictation' }));

      await waitFor(() =>
        expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message').value).toBe('spoken words'),
      );
    });

    it('reports transcription failure as a toast outside the composer', async () => {
      server.use(
        ...baseHandlers(),
        http.get(`${BASE_URL}/api/system/gateway-audio/models`, () =>
          HttpResponse.json({ speech: [], transcription: [{ id: 'openai/whisper' }] }),
        ),
        http.post(
          `${BASE_URL}/api/system/gateway-audio/transcriptions`,
          () => new HttpResponse('<html>502 Bad Gateway</html>', { status: 502 }),
        ),
      );
      render(<Toaster />);
      const { container } = renderThread([]);
      fireEvent.click(await screen.findByRole('button', { name: 'Start dictation' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Stop dictation' }));

      await screen.findByText('Could not transcribe audio.');
      expect(container.querySelector('form[data-slot="composer"] [role="alert"]')).toBeNull();
    });

    it('does not play speech that arrives after playback is stopped', async () => {
      let finishSpeech: (() => void) | undefined;
      const requested = vi.fn();
      const createObjectURL = vi.fn(() => 'blob:gateway-audio');
      vi.stubGlobal('Audio', vi.fn());
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
      server.use(
        ...baseHandlers(),
        http.get(`${BASE_URL}/api/system/gateway-audio/models`, () =>
          HttpResponse.json({ speech: [{ id: 'minimax/speech', voices: ['george'] }], transcription: [] }),
        ),
        http.post(`${BASE_URL}/api/system/gateway-audio/speech`, async ({ request }) => {
          expect(await request.json()).toEqual({
            model: 'minimax/speech',
            voice: 'george',
            input: 'A reply',
          });
          requested();
          await new Promise<void>(resolve => {
            finishSpeech = resolve;
          });
          return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } });
        }),
      );
      renderThread([assistantMessage('A reply')]);

      fireEvent.click(await screen.findByRole('button', { name: 'Read latest reply aloud' }));
      await waitFor(() => expect(requested).toHaveBeenCalledOnce());
      fireEvent.click(screen.getByRole('button', { name: 'Stop reading aloud' }));
      await act(async () => {
        finishSpeech?.();
      });

      expect(createObjectURL).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Read latest reply aloud' })).toBeTruthy();
    });
  });

  describe('when the user edits the composer after dictating', () => {
    it('keeps the edit', async () => {
      window.MASTRA_PLATFORM_PROJECT_ID = 'project-1';
      installFakeRecorder();
      server.use(
        ...baseHandlers(),
        http.get(`${BASE_URL}/api/system/gateway-audio/models`, () =>
          HttpResponse.json({ speech: [], transcription: [{ id: 'openai/whisper' }] }),
        ),
        http.post(`${BASE_URL}/api/system/gateway-audio/transcriptions`, () =>
          HttpResponse.json({ text: 'Accept the newer address.' }),
        ),
      );
      await act(async () => {
        renderThread([]);
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Start dictation' }));
      await screen.findByRole('button', { name: 'Stop dictation' });
      fireEvent.click(screen.getByRole('button', { name: 'Stop dictation' }));
      const composer = screen.getByRole<HTMLTextAreaElement>('textbox');
      await waitFor(() => expect(composer.value).toBe('Accept the newer address.'));

      await act(async () => {
        fireEvent.change(composer, { target: { value: 'Accept the newer address. Thanks' } });
      });

      expect(composer.value).toBe('Accept the newer address. Thanks');
    });
  });

  describe('when no suggested prompts are provided for an empty thread', () => {
    it('renders the default welcome state', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([]);
      });

      expect(screen.getByTestId('thread-welcome')).toBeTruthy();
      expect(screen.getByRole('textbox')).toBeTruthy();
    });

    it('renders the greeting with the agent name and the composer inside the landing column', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([]);
      });

      const heading = screen.getByRole('heading', { name: /what can .* do for you today\?/i });
      expect(heading.textContent).toContain('Helper');
      // Emphasis contract: only the agent name is high-contrast; the surrounding copy is muted and regular weight.
      expect(heading.classList.contains('font-normal')).toBe(true);
      const name = screen.getByText('Helper');
      expect(name.classList.contains('font-medium')).toBe(true);
      expect(name.classList.contains('text-foreground')).toBe(true);
      const landing = screen.getByTestId('thread-landing');
      expect(landing.contains(heading)).toBe(true);
      expect(landing.contains(screen.getByRole('textbox'))).toBe(true);
      expect(screen.queryByTestId('thread-message-column')).toBeNull();
    });
  });

  it('renders existing messages instead of the welcome state', async () => {
    server.use(...baseHandlers());

    await act(async () => {
      renderThread([userMessage('previous question')]);
    });

    expect(screen.getByText('previous question', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByTestId('thread-welcome')).toBeFalsy();
  });

  describe('Thread history loading', () => {
    describe('when history is loading and there are no messages', () => {
      it('shows the history skeleton instead of the welcome screen', async () => {
        server.use(...baseHandlers());

        await act(async () => {
          renderThread([], { isHistoryLoading: true });
        });

        expect(screen.getByTestId('thread-history-skeleton')).toBeTruthy();
        expect(screen.queryByTestId('thread-welcome')).toBeNull();
      });

      it('keeps the composer available', async () => {
        server.use(...baseHandlers());

        await act(async () => {
          renderThread([], { isHistoryLoading: true });
        });

        expect(screen.getByRole('textbox')).toBeTruthy();
      });

      it('does not render suggested prompts', async () => {
        server.use(...baseHandlers());

        await act(async () => {
          renderThread([], { isHistoryLoading: true, suggestedPrompts: ['Check the weather'] });
        });

        expect(screen.queryByRole('button', { name: 'Check the weather' })).toBeNull();
      });
    });

    describe('when history is loading but live messages already exist', () => {
      it('renders the messages and no skeleton', async () => {
        server.use(...baseHandlers());

        await act(async () => {
          renderThread([userMessage('live question')], { isHistoryLoading: true });
        });

        expect(screen.getByText('live question', { selector: 'p' })).toBeTruthy();
        expect(screen.queryByTestId('thread-history-skeleton')).toBeNull();
        expect(screen.queryByTestId('thread-welcome')).toBeNull();
      });
    });

    describe('when history finished loading with no messages', () => {
      it('shows the welcome screen with suggested prompts', async () => {
        server.use(...baseHandlers());

        await act(async () => {
          renderThread([], { isHistoryLoading: false, suggestedPrompts: ['Check the weather'] });
        });

        expect(screen.queryByTestId('thread-history-skeleton')).toBeNull();
        expect(screen.getByTestId('thread-welcome')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Check the weather' })).toBeTruthy();
      });
    });
  });

  describe('Thread pagination (fetching older messages)', () => {
    it('renders a loading skeleton at the top when fetching previous page', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([userMessage('live question')], { isLoadingPrevious: true, onLoadPrevious: vi.fn() });
      });

      // The live messages should still be visible
      expect(screen.getByText('live question', { selector: 'p' })).toBeTruthy();

      // The skeleton for fetching older messages should be rendered
      const skeletonColumn = screen.getByLabelText('Loading older messages');
      expect(skeletonColumn).toBeTruthy();
      expect(skeletonColumn.getAttribute('aria-busy')).toBe('true');
    });

    it('does not render the skeleton when not fetching previous page', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([userMessage('live question')], { isLoadingPrevious: false });
      });

      expect(screen.queryByLabelText('Loading older messages')).toBeNull();
    });
  });

  describe('when suggested prompts are provided for an empty thread', () => {
    it('renders each suggested prompt', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([], { suggestedPrompts: ['Check the weather', 'Check a stock', 'Build a page'] });
      });

      expect(screen.getByRole('button', { name: 'Check the weather' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Check a stock' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Build a page' })).toBeTruthy();
    });

    it('renders the prompts as cards with increasing entrance delays', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([], { suggestedPrompts: ['Check the weather', 'Check a stock', 'Build a page'] });
      });

      const items = Array.from(screen.getByTestId('suggested-prompt-list').querySelectorAll('li'));
      const delays = items.map(item => parseInt(item.style.animationDelay, 10));
      expect(delays).toHaveLength(3);
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
    });

    it('sends the selected prompt through the agent stream endpoint', async () => {
      const captured: Captured[] = [];
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          captured.push({ url: request.url, body: await captureBody(request) });
          return sseResponse();
        }),
      );

      await act(async () => {
        renderThread([], { suggestedPrompts: ['Check the weather'] });
      });

      fireEvent.click(screen.getByRole('button', { name: 'Check the weather' }));

      await waitFor(() => {
        expect(captured).toHaveLength(1);
      });

      expect(JSON.stringify(captured[0].body.messages ?? [])).toContain('Check the weather');
    });
  });

  describe('when the thread already has messages', () => {
    it('does not render suggested prompts', async () => {
      server.use(...baseHandlers());

      await act(async () => {
        renderThread([userMessage('previous question')], { suggestedPrompts: ['Check the weather'] });
      });

      expect(screen.queryByRole('button', { name: 'Check the weather' })).toBeFalsy();
    });
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

    it('shows a scroll-to-bottom control when the reader scrolls back up', async () => {
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

        // The opening scroll lands two frames after mount. Let it settle before the
        // reader moves, or it races the scroll below and decides the outcome instead.
        await act(
          () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );

        Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 220 });
        Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 100 });
        Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 320 });
        await act(async () => {
          fireEvent.scroll(viewport);
        });

        const scrollToEnd = screen.getByRole('button', { name: 'Scroll to end' });
        expect(scrollToEnd.getAttribute('data-active')).toBe('false');

        viewport.scrollTop = 40;
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
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

    const firstThreadTextarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
    await act(async () => {
      fireEvent.change(firstThreadTextarea, { target: { value: 'first thread draft' } });
    });
    expect(firstThreadTextarea.value).toBe('first thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-2' }));
    });

    const secondThreadTextarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
    expect(secondThreadTextarea.value).toBe('');

    await act(async () => {
      fireEvent.change(secondThreadTextarea, { target: { value: 'second thread draft' } });
    });
    expect(secondThreadTextarea.value).toBe('second thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-1' }));
    });

    expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message').value).toBe('first thread draft');

    await act(async () => {
      rendered?.rerender(renderThreadTree([], { threadId: 'thread-2' }));
    });

    expect(screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message').value).toBe('second thread draft');
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
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

      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'composing text' } });
        fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(captured).toHaveLength(0);
    });
  });

  describe('when multiple text files are uploaded and sent', () => {
    it('sends their complete text and restores distinct named previews after a fresh history fetch', async () => {
      let sentTexts: string[] = [];
      let history: ListMemoryThreadMessagesResponse = { messages: [], uiMessages: null };
      server.use(
        http.post<never, StreamParams>(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          const body = await request.json();
          history = attachmentMessages(body.messages);
          const messages = Array.isArray(body.messages) ? body.messages : [];
          sentTexts = messages.flatMap(message => {
            if (!isRecord(message)) return [];
            if (typeof message.content === 'string') return [message.content];
            if (!Array.isArray(message.content)) return [];
            return message.content.flatMap(part =>
              isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : [],
            );
          });
          return sseResponse();
        }),
        http.get(`${BASE_URL}/api/memory/threads/thread-1/messages`, () => HttpResponse.json(history)),
        ...baseHandlers(),
      );
      const csv = 'name,note\r\nZoë,"hello\nworld"\r\n';
      const notes = 'Keep <attachment>literal</attachment> text.';
      const files = [
        new File([csv], 'leads.csv'),
        new File([notes], 'settings.ini'),
        new File(['discard'], 'discard.txt'),
      ];
      // JSDOM lacks Blob.text(); FileReader still reads the actual file bytes for sending.
      Object.defineProperty(files[0], 'text', { value: async () => csv });
      Object.defineProperty(files[1], 'text', { value: async () => notes });
      Object.defineProperty(files[2], 'text', { value: async () => 'discard' });
      const mounted = renderThread([]);
      fireEvent.click(await screen.findByRole('button', { name: 'Add attachment' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Files' }));
      const input = screen.getByLabelText('Files');
      fireEvent.change(input, { target: { files } });
      await screen.findByRole('button', { name: 'Preview settings.ini' });
      await screen.findByRole('button', { name: 'Preview discard.txt' });
      fireEvent.click(screen.getByRole('button', { name: 'Remove discard.txt' }));
      expect(screen.queryByRole('button', { name: 'Preview discard.txt' })).toBeNull();
      await waitFor(() => expect(screen.queryByLabelText('Public URL')).toBeNull());
      fireEvent.change(screen.getByPlaceholderText('Enter your message'), { target: { value: 'Read both files' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() =>
        expect(sentTexts).toEqual([
          'Read both files',
          `<attachment name="leads.csv">${csv}</attachment>`,
          `<attachment name="settings.ini">${notes}</attachment>`,
        ]),
      );
      await waitFor(() => expect(screen.queryByTestId('composer-attachments')).toBeNull());
      const liveMessage = screen.getByText('Read both files').closest('[data-slot="message"]');
      expect(liveMessage).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Preview leads.csv' }).closest('[data-slot="message"]')).toBe(
        liveMessage,
      );
      expect(
        liveMessage?.querySelector('[data-slot="message-attachments"]')?.nextElementSibling?.getAttribute('data-slot'),
      ).toBe('message-content');
      mounted.unmount();
      const client = new MastraClient({ baseUrl: BASE_URL });
      const restored = await client.getMemoryThread({ threadId: 'thread-1', agentId: 'agent-1' }).listMessages();
      expect(restored.messages).toHaveLength(1);
      expect(restored.messages[0]?.content.parts).toMatchObject(sentTexts.map(text => ({ type: 'text', text })));
      renderThread(restored.messages);
      const restoredMessage = (await screen.findByText('Read both files')).closest('[data-slot="message"]');
      expect(restoredMessage).not.toBeNull();
      expect(
        restoredMessage
          ?.querySelector('[data-slot="message-attachments"]')
          ?.nextElementSibling?.getAttribute('data-slot'),
      ).toBe('message-content');
      for (const [name, text] of [
        ['leads.csv', csv],
        ['settings.ini', notes],
      ]) {
        const preview = await screen.findByRole('button', { name: `Preview ${name}` });
        expect(preview.closest('[data-slot="message"]')).toBe(restoredMessage);
        fireEvent.click(preview);
        const dialog = screen.getByRole('dialog', { name });
        expect(within(dialog).getByText(text, { normalizer: value => value }).textContent).toBe(text);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      }
    });
  });

  describe.each(['file classification', 'URL inspection'])('when %s is pending', inspection => {
    it('keeps the attachment until it can be included in the submitted message', async () => {
      const captured: CapturedBody[] = [];
      let release = () => {};
      const pending = new Promise<void>(resolve => {
        release = resolve;
      });
      const url = 'https://files.example.com/report.pdf';
      server.use(
        ...baseHandlers(),
        http.head(url, async () => {
          await pending;
          return new HttpResponse(null, { headers: { 'content-type': 'application/pdf' } });
        }),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          captured.push(await captureBody(request));
          return sseResponse();
        }),
      );
      const read = FileReader.prototype.readAsArrayBuffer;
      const probe = vi
        .spyOn(FileReader.prototype, 'readAsArrayBuffer')
        .mockImplementation(function (this: FileReader, blob) {
          void pending.then(() => read.call(this, blob));
        });
      try {
        await act(async () => {
          renderThread([]);
        });
        const textarea = screen.getByPlaceholderText('Enter your message');
        fireEvent.change(textarea, { target: { value: 'Read my attachment' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
        if (inspection === 'file classification') {
          fireEvent.click(await screen.findByRole('menuitem', { name: 'Files' }));
          const picker = screen.getByLabelText('Files');
          const file = new File(['pending file contents'], 'notes.unknown');
          Object.defineProperty(file, 'text', { value: async () => 'pending file contents' });
          fireEvent.change(picker, { target: { files: [file] } });
          expect(probe).toHaveBeenCalledOnce();
        } else {
          fireEvent.click(await screen.findByRole('menuitem', { name: 'From a URL…' }));
          const input = await screen.findByLabelText('Public URL');
          fireEvent.change(input, { target: { value: url } });
          const form = input.closest('form');
          if (!form) throw new Error('Attachment form is missing');
          fireEvent.submit(form);
        }
        const composer = textarea.closest('form');
        if (!composer) throw new Error('Composer form is missing');
        await act(async () => {
          fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
          fireEvent.submit(composer);
        });
        expect(captured).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Send', hidden: true }).hasAttribute('disabled')).toBe(true);
        await act(async () => {
          release();
          await pending;
        });
        await waitFor(() => expect(screen.queryByLabelText('Public URL')).toBeNull());
        await waitFor(() => expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        await waitFor(() => expect(captured).toHaveLength(1));
        const messages = JSON.stringify(captured[0].messages);
        expect(messages).toContain('Read my attachment');
        expect(messages).toContain(inspection === 'file classification' ? 'pending file contents' : url);
      } finally {
        release();
        probe.mockRestore();
      }
    });
  });

  describe('when the server rejects the message', () => {
    it('puts the text and the attachment back in the composer', async () => {
      let requests = 0;
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, () => {
          requests++;
          return HttpResponse.json({ error: 'Request body too large' }, { status: 413 });
        }),
      );
      await act(async () => {
        renderThread([]);
      });
      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
      fireEvent.change(textarea, { target: { value: 'Read my spreadsheet' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Files' }));
      const picker = screen.getByLabelText('Files');
      fireEvent.change(picker, { target: { files: [new File([new Uint8Array([80, 75, 3, 4])], 'leads.xlsx')] } });
      await screen.findByRole('button', { name: 'Remove leads.xlsx' });

      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(requests).toBeGreaterThan(0));

      expect(await screen.findByText(/could not be sent/i, undefined, { timeout: 5000 })).toBeTruthy();
      expect(textarea.value).toBe('Read my spreadsheet');
      expect(screen.getByRole('button', { name: 'Remove leads.xlsx' })).toBeTruthy();
    }, 10_000);

    it('keeps the text typed while the request was pending, after the restored message', async () => {
      let rejectRequest = () => {};
      const pending = new Promise<void>(resolve => {
        rejectRequest = resolve;
      });
      let requests = 0;
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, async () => {
          requests++;
          await pending;
          return HttpResponse.json({ error: 'Request body too large' }, { status: 413 });
        }),
      );
      await act(async () => {
        renderThread([]);
      });
      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
      fireEvent.change(textarea, { target: { value: 'Read my spreadsheet' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(requests).toBe(1));
      await waitFor(() => expect(textarea.value).toBe(''));

      fireEvent.change(textarea, { target: { value: 'And the second tab?' } });
      rejectRequest();

      expect(await screen.findByText(/could not be sent/i, undefined, { timeout: 5000 })).toBeTruthy();
      expect(textarea.value).toBe('Read my spreadsheet\n\nAnd the second tab?');
    }, 10_000);

    it('puts the text back in the composer in generate mode too', async () => {
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/agent-1/generate`, () =>
          HttpResponse.json({ error: 'Request body too large' }, { status: 413 }),
        ),
      );
      await act(async () => {
        renderThread([], { modelSettings: { chatWithGenerate: true } });
      });
      const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
      fireEvent.change(textarea, { target: { value: 'Read my spreadsheet' } });

      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(await screen.findByText(/could not be sent/i, undefined, { timeout: 5000 })).toBeTruthy();
      expect(textarea.value).toBe('Read my spreadsheet');
    }, 10_000);
  });

  // A server error can come after the agent ran and stored the turn: sending the draft again would duplicate it.
  describe('when the server fails while handling the message', () => {
    it.each([
      ['stream', {}],
      ['generate', { chatWithGenerate: true }],
    ])(
      'keeps the composer empty and shows the error (%s)',
      async (endpoint, modelSettings) => {
        server.use(
          ...baseHandlers(),
          http.post(`${BASE_URL}/api/agents/agent-1/${endpoint}`, () =>
            HttpResponse.json({ error: 'The model provider failed' }, { status: 500 }),
          ),
        );
        await act(async () => {
          renderThread([], { modelSettings });
        });
        const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
        fireEvent.change(textarea, { target: { value: 'Summarize my notes' } });

        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        expect(await screen.findByText(/The model provider failed/, undefined, { timeout: 5000 })).toBeTruthy();
        await act(async () => {}); // lets a pending restore land before checking it didn't happen
        expect(screen.queryByText(/could not be sent/i)).toBeNull();
        expect(textarea.value).toBe('');
      },
      10_000,
    );
  });

  describe('when a text attachment is added by URL', () => {
    it('keeps the attachment in the same composer surface as the draft', async () => {
      const url = 'https://files.example.com/leads.csv';
      server.use(
        ...baseHandlers(),
        http.head(url, () => new HttpResponse(null, { headers: { 'content-type': 'text/csv' } })),
      );
      await act(async () => {
        renderThread([]);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'From a URL…' }));
      const input = await screen.findByLabelText('Public URL');
      fireEvent.change(input, { target: { value: url } });
      const form = input.closest('form');
      if (!form) throw new Error('Attachment form is missing');
      fireEvent.submit(form);

      const attachments = await screen.findByTestId('composer-attachments');
      const draft = screen.getByPlaceholderText('Enter your message');
      const composerBox = draft.closest('[data-slot="composer-box"]');
      expect(composerBox).not.toBeNull();
      expect(composerBox?.contains(attachments)).toBe(true);
      expect(attachments.parentElement?.closest('[data-slot="composer-attachments"]')).toBeNull();
    });

    it('links to the original URL instead of offering an empty file preview', async () => {
      const url = 'https://files.example.com/leads.csv';
      server.use(
        ...baseHandlers(),
        http.head(url, () => new HttpResponse(null, { headers: { 'content-type': 'text/csv' } })),
      );
      await act(async () => {
        renderThread([]);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add attachment' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'From a URL…' }));
      const input = await screen.findByLabelText('Public URL');
      fireEvent.change(input, { target: { value: url } });
      const form = input.closest<HTMLFormElement>('form');
      if (!form) throw new Error('Attachment form is missing');
      fireEvent.submit(form);
      const attachments = await screen.findByTestId('composer-attachments');
      const link = await within(attachments).findByRole('link');
      expect(link.getAttribute('href')).toBe(url);
      expect(within(attachments).queryByRole('button', { name: `Preview ${url}` })).toBeNull();
    });
  });

  it('attaches a URL from the menu dialog without sending the chat message', async () => {
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

    fireEvent.click(await screen.findByRole('menuitem', { name: 'From a URL…' }));

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

    // The attachment chip row appears and the dialog closes.
    await waitFor(() => {
      expect(screen.getByTestId('composer-attachments')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Public URL')).toBeFalsy();
    });
    // Submitting the dialog form must not bubble into the composer form and send a chat message.
    expect(captured).toHaveLength(0);
  });

  describe('when thread signals allow sending during a run', () => {
    let subscription: ReadableStreamDefaultController<Uint8Array> | undefined;
    let sentMessages: string[];
    let abortRequests: number;

    beforeEach(async () => {
      window.MASTRA_AGENT_SIGNALS = 'true';
      subscription = undefined;
      sentMessages = [];
      abortRequests = 0;
      server.use(...baseHandlers());
      server.use(
        http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryEnabled)),
        http.post(
          `${BASE_URL}/api/agents/:agentId/threads/subscribe`,
          () =>
            new HttpResponse(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  subscription = controller;
                },
              }),
              { headers: { 'content-type': 'text/event-stream' } },
            ),
        ),
        http.post(`${BASE_URL}/api/agents/:agentId/send-message`, async ({ request }) => {
          sentMessages.push(JSON.stringify(await request.json()));
          return HttpResponse.json(acceptedSignalMessage);
        }),
        http.post(`${BASE_URL}/api/agents/:agentId/threads/abort`, () => {
          abortRequests += 1;
          return HttpResponse.json(abortedSignalRun);
        }),
      );

      await act(async () => {
        renderThread([]);
      });
      await waitFor(() => expect(subscription).toBeDefined());
      await act(async () => subscription?.enqueue(new TextEncoder().encode(sseChunk(signalRunStart))));
      await screen.findByRole('button', { name: 'Cancel' });
    });

    afterEach(async () => {
      await act(async () => subscription?.close());
    });

    it('replaces cancel with send while drafting and restores cancel after clearing the draft', () => {
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();

      const textarea = screen.getByPlaceholderText('Enter your message');
      fireEvent.change(textarea, { target: { value: '   ' } });
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();

      fireEvent.change(textarea, { target: { value: 'Continue with the new instructions' } });
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);

      fireEvent.change(textarea, { target: { value: '' } });
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    });

    it('does not cancel the run when Send is double-clicked', async () => {
      fireEvent.change(screen.getByPlaceholderText('Enter your message'), {
        target: { value: 'Continue with the new instructions' },
      });
      const primaryAction = screen.getByRole('button', { name: 'Send' });
      fireEvent.click(primaryAction, { detail: 1 });
      await waitFor(() => expect(sentMessages.join()).toContain('Continue with the new instructions'));
      fireEvent.click(primaryAction, { detail: 2 });
      await act(async () => new Promise(resolve => setTimeout(resolve, 100)));

      expect(abortRequests).toBe(0);
    });

    it('cancels the run when Cancel is clicked', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }), { detail: 1 });

      await waitFor(() => expect(abortRequests).toBe(1));
    });
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'long running' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
    });

    fireEvent.change(textarea, { target: { value: 'Wait until this run finishes' } });
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();

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

describe('Thread annotations', () => {
  const REPLY = 'Open rows drop the frame and keep a subtle rounded hover.';
  const history = () => [userMessage('Which table style should we use?'), assistantMessage(REPLY)];

  beforeEach(() => {
    window.MASTRA_AGENT_SIGNALS = 'false';
    server.resetHandlers();
  });

  afterEach(() => {
    document.getSelection()?.removeAllRanges();
  });

  const selectFromReply = async (length: number) => {
    const paragraph = await screen.findByText(REPLY);
    const text = paragraph.firstChild;
    if (!(text instanceof Text)) throw new Error('The reply has no text node');
    fireEvent.pointerDown(paragraph);
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, length);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.pointerUp(paragraph);
  };

  const markers = () =>
    Array.from(screen.getByTestId('thread-message-column').querySelectorAll('[data-slot="annotation-marker"]')).map(
      marker => marker.textContent,
    );

  const renderCapturingThread = async () => {
    const captured: Captured[] = [];
    server.use(
      ...baseHandlers(),
      http.post(`${BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        captured.push({ url: request.url, body: await captureBody(request) });
        return sseResponse();
      }),
    );
    await act(async () => {
      renderThread(history());
    });
    return captured;
  };

  const addToChat = async () => {
    await selectFromReply('Open rows'.length);
    fireEvent.click(await screen.findByRole('button', { name: 'Add to chat' }));
  };

  const textarea = () => screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');

  describe('when part of a reply is added to the chat', () => {
    let captured: Captured[];

    beforeEach(async () => {
      captured = await renderCapturingThread();
      await addToChat();
    });

    it('numbers the passage in the transcript', () => {
      expect(markers()).toEqual(['1']);
    });

    it('counts the annotation in the composer', () => {
      expect(screen.getByRole('button', { name: '1 annotation' })).toBeTruthy();
    });

    it('focuses the message box', () => {
      expect(document.activeElement).toBe(textarea());
    });

    describe('when the person types a message and sends it', () => {
      beforeEach(() => {
        fireEvent.change(textarea(), { target: { value: 'Why this one?' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      });

      it('reaches the agent as a blockquote ahead of the typed message', async () => {
        await waitFor(() => expect(captured).toHaveLength(1));
        expect(JSON.stringify(captured[0].body.messages)).toContain(
          JSON.stringify('1. > Open rows\n\nWhy this one?').slice(1, -1),
        );
      });

      it('clears the annotation from the composer', async () => {
        await waitFor(() => expect(screen.queryByRole('button', { name: '1 annotation' })).toBeNull());
      });

      it('removes the number from the transcript', async () => {
        await waitFor(() => expect(markers()).toEqual([]));
      });
    });
  });

  describe('when the person sends an annotation without typing', () => {
    let captured: Captured[];

    beforeEach(async () => {
      captured = await renderCapturingThread();
      await addToChat();
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    it('sends the quoted passage on its own', async () => {
      await waitFor(() => expect(captured).toHaveLength(1));
      expect(JSON.stringify(captured[0].body.messages)).toContain(JSON.stringify('1. > Open rows'));
    });

    it('clears the annotation from the composer', async () => {
      await waitFor(() => expect(screen.queryByRole('button', { name: '1 annotation' })).toBeNull());
    });
  });

  describe('when the server rejects the message with the annotation', () => {
    beforeEach(async () => {
      let requests = 0;
      server.use(
        ...baseHandlers(),
        http.post(`${BASE_URL}/api/agents/agent-1/stream`, () => {
          requests++;
          return HttpResponse.json({ error: 'Request body too large' }, { status: 413 });
        }),
      );
      await act(async () => {
        renderThread(history());
      });
      await addToChat();
      fireEvent.change(textarea(), { target: { value: 'Why this one?' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(requests).toBeGreaterThan(0));
    });

    it('tells the person the message could not be sent', async () => {
      expect(await screen.findByText(/could not be sent/i, undefined, { timeout: 5000 })).toBeTruthy();
    }, 10_000);

    it('puts the typed text back in the composer', async () => {
      await waitFor(() => expect(textarea().value).toBe('Why this one?'), { timeout: 5000 });
    }, 10_000);

    it('puts the annotation back in the composer', async () => {
      expect(await screen.findByRole('button', { name: '1 annotation' }, { timeout: 5000 })).toBeTruthy();
    }, 10_000);

    it('puts the annotation back on the transcript', async () => {
      await waitFor(() => expect(markers()).toEqual(['1']), { timeout: 5000 });
    }, 10_000);
  });

  describe('when the person opens another thread before sending the annotation', () => {
    beforeEach(async () => {
      server.use(...baseHandlers());
      let rendered: ReturnType<typeof render> | undefined;
      await act(async () => {
        rendered = render(renderThreadTree(history(), { threadId: 'thread-1' }));
      });
      await addToChat();
      await screen.findByRole('button', { name: '1 annotation' });

      await act(async () => {
        rendered?.rerender(renderThreadTree(history(), { threadId: 'thread-2' }));
      });
    });

    it('starts the other thread with an empty composer annotation list', () => {
      expect(screen.queryByRole('button', { name: /annotation/ })).toBeNull();
    });

    it('starts the other thread without annotation bubbles', () => {
      expect(markers()).toEqual([]);
    });
  });
});

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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
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
    expect(screen.getByRole('button', { name: 'Collapse tasks' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText('In progress')).toBeTruthy();
    expect(screen.getAllByLabelText('Pending')).toHaveLength(2);
    expect(screen.getByText('Planning menu')).toBeTruthy();
    expect(screen.getByText('Create shopping list')).toBeTruthy();
    expect(screen.getByText('Cook meal')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse tasks' }));
    const progress = screen.getByRole('progressbar', { name: 'Task completion' });
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('3');

    await close();
  });

  it('updates the task list when a task-list-update delta streams in', async () => {
    const { pushTasks, close } = await renderWithControlledSubscription();
    const completedPlan: TaskItem = { ...taskPlanMenu, status: 'completed' };
    const activeShop: TaskItem = { ...taskShop, status: 'in_progress', activeForm: 'Shopping for ingredients' };

    await pushTasks([taskPlanMenu, taskShop]);
    await pushTasks([completedPlan, activeShop], 'task-list-update');

    await waitFor(() => {
      expect(screen.getByLabelText('Completed')).toBeTruthy();
      expect(screen.getByLabelText('In progress')).toBeTruthy();
    });
    expect(screen.getByText('Plan menu')).toBeTruthy();
    expect(screen.getByText('Shopping for ingredients')).toBeTruthy();
    expect(screen.getByText('Planning menu').closest('[aria-hidden="true"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse tasks' }));
    const progress = screen.getByRole('progressbar', { name: 'Task completion' });
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('2');

    await close();
  });

  it('scrolls the active task into view when task state updates', async () => {
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');
    const matchMedia = window.matchMedia;
    const reducedMotion = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      ...matchMedia(query),
      matches: query === '(prefers-reduced-motion: reduce)',
    }));
    const { pushTasks, close } = await renderWithControlledSubscription();

    try {
      await pushTasks([taskPlanMenu, taskShop, taskCook]);
      fireEvent.click(screen.getByRole('button', { name: 'Collapse tasks' }));
      scrollTo.mockClear();

      const completedPlan: TaskItem = { ...taskPlanMenu, status: 'completed' };
      const activeShop: TaskItem = { ...taskShop, status: 'in_progress', activeForm: 'Shopping for ingredients' };
      await pushTasks([completedPlan, activeShop, taskCook], 'task-list-update');

      await waitFor(() => {
        expect(scrollTo).toHaveBeenCalledWith({ top: 28 });
      });
      expect(screen.getByRole('listitem').textContent).toContain('Shopping for ingredients');
    } finally {
      reducedMotion.mockRestore();
      scrollTo.mockRestore();
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
    server.use(...baseHandlers());
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

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>('Enter your message');
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
