import type { BuilderModelPolicy } from '@mastra/client-js';
import { useChatSend } from '@mastra/playground-ui/domains/chat/context/chat-context';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HttpHandler } from 'msw';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAgentSettings } from '../agent-context';
import { WorkingMemoryProvider } from '../agent-working-memory-context';
import { usePlaygroundModel } from '../playground-model-context';
import { ThreadPreferencesProvider } from '../thread-preferences-provider';
import {
  allowedModels,
  restrictedModels,
  currentUser,
  memoryConfig,
  workingMemory,
} from './fixtures/thread-preferences';
import { buildBuilderSettings } from '@/domains/agent-builder/hooks/__tests__/fixtures/builder-settings';
import { ChatProvider } from '@/lib/ai-ui/chat/chat-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const defaults = { modelSettings: { temperature: 0.9, maxSteps: 5, chatWithLegacyStream: true } };
const messages: [] = [];

function Controls() {
  const { model, setModel, setProvider } = usePlaygroundModel();
  const { settings, setSettings, resetAll } = useAgentSettings();
  const send = useChatSend();
  return (
    <>
      <output>
        {model}:{settings?.modelSettings.temperature}
      </output>
      <button
        onClick={() => {
          setModel('openai', 'gpt-4o-mini');
          setSettings({ modelSettings: { ...settings?.modelSettings, temperature: 0.2, maxSteps: 8 } });
        }}
      >
        Customize
      </button>
      <button onClick={() => setSettings({ modelSettings: { ...settings?.modelSettings, temperature: undefined } })}>
        Clear temperature
      </button>
      <button onClick={() => setProvider('openai')}>Select provider</button>
      <button onClick={() => resetAll()}>Reset settings</button>
      <button onClick={() => send({ message: 'Hello' })}>Send</button>
    </>
  );
}

function Chat({ agentId, threadId }: { agentId: string; threadId: string }) {
  const { settings } = useAgentSettings();
  return (
    <WorkingMemoryProvider agentId={agentId} threadId={threadId} resourceId={agentId}>
      <ChatProvider
        agentId={agentId}
        threadId={threadId}
        initialMessages={messages}
        settings={settings}
        supportsMemory={false}
      >
        <Controls />
      </ChatProvider>
    </WorkingMemoryProvider>
  );
}

function Session({ threadId, agentId = 'agent-1' }: { threadId: string; agentId?: string }) {
  return (
    <ThreadPreferencesProvider
      agentId={agentId}
      threadId={threadId}
      defaultProvider="openai"
      defaultModel="gpt-4o"
      defaultSettings={defaults}
    >
      <Chat agentId={agentId} threadId={threadId} />
    </ThreadPreferencesProvider>
  );
}

function mountSession(
  threadId = 'thread-a',
  modelPolicy: BuilderModelPolicy = { active: false },
  modelsHandler?: HttpHandler,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['builder-settings'], buildBuilderSettings({ modelPolicy }));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(buildBuilderSettings({ modelPolicy }))),
    modelsHandler ??
      http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(currentUser)),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(memoryConfig)),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => HttpResponse.json(workingMemory)),
  );
  return { ...render(<Session threadId={threadId} />, { wrapper }), client };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('ThreadPreferencesProvider', () => {
  describe('when a customized chat is revisited', () => {
    it('isolates a different chat and restores the original preferences', async () => {
      const view = mountSession();
      fireEvent.click(screen.getByText('Customize'));
      view.rerender(<Session threadId="thread-b" />);
      expect(screen.getByText('gpt-4o:0.9')).toBeTruthy();
      view.rerender(<Session threadId="thread-a" />);
      expect(screen.getByText('gpt-4o-mini:0.2')).toBeTruthy();
    });
    it('restores preferences after a fresh mount and sends them to the server', async () => {
      const bodies: unknown[] = [];
      server.use(
        http.post(`${BASE_URL}/api/agents/:agentId/stream`, async ({ request }) => {
          bodies.push(await request.json());
          return new HttpResponse('data: {"type":"finish","payload":{}}\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          });
        }),
      );
      const view = mountSession();
      fireEvent.click(screen.getByText('Customize'));
      view.unmount();
      mountSession();
      expect(screen.getByText('gpt-4o-mini:0.2')).toBeTruthy();
      fireEvent.click(screen.getByText('Send'));
      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toMatchObject({
        model: 'openai/gpt-4o-mini',
        maxSteps: 8,
        modelSettings: { temperature: 0.2 },
      });
    });
    it('does not leak preferences to another agent with the same thread ID', () => {
      const view = mountSession();
      fireEvent.click(screen.getByText('Customize'));
      view.rerender(<Session agentId="agent-2" threadId="thread-a" />);
      expect(screen.getByText('gpt-4o:0.9')).toBeTruthy();
    });
    it('keeps an explicit settings reset after remounting', () => {
      const view = mountSession();
      fireEvent.click(screen.getByText('Customize'));
      fireEvent.click(screen.getByText('Reset settings'));
      view.unmount();
      mountSession();
      expect(screen.getByText('gpt-4o-mini:0.9')).toBeTruthy();
    });
  });

  describe('while the allowed-model list is loading', () => {
    it.each([false, true])('does not apply an override until policy resolves (locked: %s)', async locked => {
      localStorage.setItem(
        'mastra-thread-preferences-["agent-1","thread-a"]',
        JSON.stringify({
          selection: { provider: 'openai', model: 'gpt-4o-mini' },
        }),
      );
      let release = () => {};
      const pending = new Promise<void>(resolve => {
        release = resolve;
      });
      const requested = vi.fn();
      const sent = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/agents/:agentId/stream`, async ({ request }) => {
          sent(await request.json());
          return new HttpResponse('data: {"type":"finish","payload":{}}\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          });
        }),
      );
      mountSession(
        'thread-a',
        {
          active: true,
          pickerVisible: !locked,
          allowed: [{ provider: 'openai' }],
          default: { provider: 'openai', modelId: 'gpt-5-mini' },
        },
        http.get(`${BASE_URL}/api/editor/builder/models/available`, async () => {
          requested();
          await pending;
          return HttpResponse.json(allowedModels);
        }),
      );
      try {
        await waitFor(() => expect(requested).toHaveBeenCalledOnce());
        expect(screen.getByText('gpt-4o:0.9')).toBeTruthy();
        fireEvent.click(screen.getByText('Send'));
        await waitFor(() => expect(sent).toHaveBeenCalledOnce());
        expect(sent.mock.calls[0][0]).not.toHaveProperty('model');
        await act(async () => release());
        const expectedModel = locked ? 'gpt-5-mini' : 'gpt-4o-mini';
        await screen.findByText(`${expectedModel}:0.9`);
        fireEvent.click(screen.getByText('Send'));
        await waitFor(() => expect(sent).toHaveBeenCalledTimes(2));
        expect(sent.mock.calls[1][0]).toMatchObject({ model: `openai/${expectedModel}` });
      } finally {
        release();
      }
    });
  });

  describe('when model policy restricts a saved selection', () => {
    it.each([false, true])('uses the policy default for display and requests (locked: %s)', async locked => {
      localStorage.setItem(
        'mastra-thread-preferences-["agent-1","thread-a"]',
        JSON.stringify({
          selection: { provider: 'openai', model: 'gpt-4o-mini' },
        }),
      );
      const bodies: unknown[] = [];
      server.use(
        http.post(`${BASE_URL}/api/agents/:agentId/stream`, async ({ request }) => {
          bodies.push(await request.json());
          return new HttpResponse('data: {"type":"finish","payload":{}}\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          });
        }),
      );
      const view = mountSession(
        'thread-a',
        {
          active: true,
          pickerVisible: !locked,
          allowed: [{ provider: 'openai', modelId: 'gpt-5-mini' }],
          default: { provider: 'openai', modelId: 'gpt-5-mini' },
        },
        http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json(restrictedModels)),
      );
      await waitFor(() => expect(view.client.getQueryData(['builder-available-models'])).toEqual(restrictedModels));
      expect(screen.getByText('gpt-5-mini:0.9')).toBeTruthy();
      fireEvent.click(screen.getByText('Send'));
      await waitFor(() => expect(bodies).toHaveLength(1));
      expect(bodies[0]).toMatchObject({ model: 'openai/gpt-5-mini' });
    });

    it('restores an allowed model and supports selecting a provider before its model', async () => {
      localStorage.setItem(
        'mastra-thread-preferences-["agent-1","thread-a"]',
        JSON.stringify({
          selection: { provider: 'openai', model: 'gpt-4o-mini' },
        }),
      );
      const view = mountSession('thread-a', { active: true, allowed: [{ provider: 'openai' }] });
      await waitFor(() => expect(view.client.isFetching({ queryKey: ['builder-available-models'] })).toBe(0));
      server.use(http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json(allowedModels)));
      await act(() => view.client.invalidateQueries({ queryKey: ['builder-available-models'] }));
      await waitFor(() => expect(screen.getByText('gpt-4o-mini:0.9')).toBeTruthy());
      fireEvent.click(screen.getByText('Select provider'));
      expect(screen.getByText(':0.9')).toBeTruthy();
      fireEvent.click(screen.getByText('Customize'));
      expect(screen.getByText('gpt-4o-mini:0.2')).toBeTruthy();
    });

    it('does not send the saved override when the policy request fails', async () => {
      const view = mountSession();
      fireEvent.click(screen.getByText('Customize'));
      const sent = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/editor/builder/settings`, () => new HttpResponse(null, { status: 500 })),
        http.post(`${BASE_URL}/api/agents/:agentId/stream`, async ({ request }) => {
          sent(await request.json());
          return new HttpResponse('data: {"type":"finish","payload":{}}\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          });
        }),
      );
      await act(() => view.client.invalidateQueries({ queryKey: ['builder-settings'] }));
      await waitFor(() => expect(screen.getByText('gpt-4o:0.2')).toBeTruthy());
      fireEvent.click(screen.getByText('Send'));
      await waitFor(() => expect(sent).toHaveBeenCalledOnce());
      expect(sent.mock.calls[0][0]).not.toHaveProperty('model');
    });

    it('reconciles policy changes without replacing the saved preference', async () => {
      const view = mountSession();
      fireEvent.click(screen.getByText('Customize'));
      server.use(
        http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
          HttpResponse.json(
            buildBuilderSettings({
              modelPolicy: {
                active: true,
                pickerVisible: false,
                default: { provider: 'openai', modelId: 'gpt-5-mini' },
              },
            }),
          ),
        ),
      );
      await act(() => view.client.invalidateQueries({ queryKey: ['builder-settings'] }));
      await waitFor(() => expect(screen.getByText('gpt-5-mini:0.2')).toBeTruthy());
      expect(
        JSON.parse(localStorage.getItem('mastra-thread-preferences-["agent-1","thread-a"]')!).selection.model,
      ).toBe('gpt-4o-mini');
    });
  });

  describe('when a code-default setting is explicitly cleared', () => {
    it('keeps the field unset after switching chats and remounting', () => {
      const view = mountSession();
      fireEvent.click(screen.getByText('Clear temperature'));
      expect(screen.getByText('gpt-4o:')).toBeTruthy();
      view.rerender(<Session threadId="thread-b" />);
      view.rerender(<Session threadId="thread-a" />);
      expect(screen.getByText('gpt-4o:')).toBeTruthy();
      view.unmount();
      mountSession();
      expect(screen.getByText('gpt-4o:')).toBeTruthy();
    });
  });

  describe('when only legacy agent settings exist', () => {
    it('migrates them once without linking later changes between chats', () => {
      localStorage.setItem('mastra-agent-store-agent-1', JSON.stringify({ modelSettings: { temperature: 0.4 } }));
      const view = mountSession();
      expect(screen.getByText('gpt-4o:0.4')).toBeTruthy();
      fireEvent.click(screen.getByText('Customize'));
      view.rerender(<Session threadId="thread-b" />);
      expect(screen.getByText('gpt-4o:0.4')).toBeTruthy();
      localStorage.setItem('mastra-agent-store-agent-1', JSON.stringify({ modelSettings: { temperature: 0.7 } }));
      view.rerender(<Session threadId="thread-a" />);
      expect(screen.getByText('gpt-4o-mini:0.2')).toBeTruthy();
      fireEvent.click(screen.getByText('Reset settings'));
      view.unmount();
      mountSession();
      expect(screen.getByText('gpt-4o-mini:0.9')).toBeTruthy();
    });
  });

  describe('when stored preferences are partially invalid', () => {
    it('keeps valid model and settings fields while falling back for invalid fields', () => {
      localStorage.setItem(
        'mastra-thread-preferences-["agent-1","thread-a"]',
        JSON.stringify({
          selection: { provider: 'openai', model: 'gpt-4o-mini' },
          modelSettings: { temperature: 0.2, maxSteps: 'bad', providerOptions: 'bad' },
        }),
      );
      mountSession();
      expect(screen.getByText('gpt-4o-mini:0.2')).toBeTruthy();
    });
    it('keeps settings when only the selection is invalid', () => {
      localStorage.setItem(
        'mastra-thread-preferences-["agent-1","thread-a"]',
        JSON.stringify({
          selection: { provider: 42 },
          modelSettings: { temperature: 0.2 },
        }),
      );
      mountSession();
      expect(screen.getByText('gpt-4o:0.2')).toBeTruthy();
    });
  });

  describe('when stored preferences are invalid', () => {
    it.each(['not-json', '{"selection":{"model":42}}'])('uses defaults for %s', stored => {
      localStorage.setItem('mastra-thread-preferences-["agent-1","thread-a"]', stored);
      mountSession();
      expect(screen.getByText('gpt-4o:0.9')).toBeTruthy();
    });
  });

  describe('when browser storage is unavailable', () => {
    it('still lets the user customize the current chat', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage denied');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage denied');
      });
      mountSession();
      fireEvent.click(screen.getByText('Customize'));
      expect(screen.getByText('gpt-4o-mini:0.2')).toBeTruthy();
    });
  });
});
