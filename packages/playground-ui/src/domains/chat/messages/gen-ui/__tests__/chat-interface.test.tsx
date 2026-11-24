// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { JSON_RENDER_STATE } from '@mastra/json-render/studio';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatMessagesContext, ChatRunningContext, ChatSendContext } from '@/domains/chat/context/chat-context';
import type { ChatSendArgs } from '@/domains/chat/context/chat-context';
import { MessageRow } from '@/domains/chat/messages/message-row';

const BASE_URL = 'http://localhost:4111';
const PROSE = `Here you go. ${Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')}`;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Part = MastraDBMessage['content']['parts'][number];

const patch = (path: string, value: unknown) =>
  ({ type: 'data-spec', data: { type: 'patch', patch: { op: 'add', path, value } } }) as unknown as Part;

// The order the catalog prompt asks for: elements first, then the state they bind to.
const signupPatches = [
  patch('/root', 'card'),
  patch('/elements/card', { type: 'Card', props: { title: 'Join the beta' }, children: ['email', 'join'] }),
  patch('/elements/email', {
    type: 'Input',
    props: { label: 'Email', value: { $bindState: '/email' }, type: 'email' },
    children: [],
  }),
  patch('/elements/join', {
    type: 'Button',
    props: { label: 'Join' },
    on: { press: { action: 'sendMessage', params: { message: 'Sign me up' } } },
    children: [],
  }),
  patch('/state/email', 'ada@example.com'),
];

const reply = (id: string, parts: Part[], runId = 'run-1'): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts, metadata: { runId } },
});

interface ChatState {
  messages: MastraDBMessage[];
  isRunning?: boolean;
  activeRunId?: string;
  send: (args: ChatSendArgs) => void;
}

function Chat({ chat, children }: { chat: ChatState; children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ChatMessagesContext.Provider value={{ messages: chat.messages }}>
            <ChatSendContext.Provider value={{ send: chat.send }}>
              <ChatRunningContext.Provider
                value={{
                  isRunning: chat.isRunning ?? false,
                  activeRunId: chat.activeRunId,
                  cancelRun: () => {},
                  canSendWhileStreaming: false,
                }}
              >
                {children}
              </ChatRunningContext.Provider>
            </ChatSendContext.Provider>
          </ChatMessagesContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

describe('an interface in a reply Studio is still drawing', () => {
  it('waits for the whole reply to be drawn, so it starts from the state the agent wrote last', async () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const streaming = reply('msg-1', [{ type: 'text', text: 'Here', state: 'streaming' } as Part]);
    const finished = reply('msg-1', [{ type: 'text', text: PROSE, state: 'done' } as Part, ...signupPatches]);

    const { rerender } = render(
      <Chat chat={{ messages: [streaming], send }}>
        <MessageRow message={streaming} />
      </Chat>,
    );
    // The run has ended, but the reveal is still laying the reply down.
    rerender(
      <Chat chat={{ messages: [finished], send }}>
        <MessageRow message={finished} />
      </Chat>,
    );

    const join = () => screen.queryByRole('button', { name: 'Join' });
    for (let frames = 0; frames < 600 && (join()?.hasAttribute('disabled') ?? true); frames++) {
      act(() => void vi.advanceTimersByTime(16));
    }

    expect(join()?.hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Email' }).value).toBe('ada@example.com');

    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Join' })));
    expect(send).toHaveBeenCalledWith({
      message: 'Sign me up',
      requestContext: { [JSON_RENDER_STATE]: { email: 'ada@example.com' } },
    });
  });
});

describe('the latest interface in a thread', () => {
  it('cannot answer while a follow-up reply is streaming elsewhere in the thread', () => {
    const send = vi.fn();
    const withInterface = reply('msg-1', signupPatches);
    const followUp = reply('msg-2', [{ type: 'text', text: 'Thinking', state: 'streaming' } as Part], 'run-2');

    render(
      <Chat chat={{ messages: [withInterface, followUp], isRunning: true, activeRunId: 'run-2', send }}>
        <MessageRow message={withInterface} />
      </Chat>,
    );

    expect(screen.getByRole('button', { name: 'Join' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Email' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps what the user entered after the reply to their submission', () => {
    const send = vi.fn();
    const withInterface = reply('msg-1', signupPatches);
    const view = (isRunning: boolean) => (
      <Chat chat={{ messages: [withInterface], isRunning, send }}>
        <MessageRow message={withInterface} />
      </Chat>
    );

    const { rerender } = render(view(false));
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'grace@example.com' } });
    rerender(view(true));
    rerender(view(false));

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Email' }).value).toBe('grace@example.com');
  });
});
