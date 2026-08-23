import type { AgentControllerEvent, MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

const generateThreadTitleMock = vi.hoisted(() => vi.fn());
vi.mock('@mastra/code-sdk', () => ({
  generateThreadTitle: (options: { prompt: string }) => generateThreadTitleMock(options),
}));

import { createThreadTitleGenerator, observeSessionThreadTitle, type ThreadTitleSession } from './thread-title.js';

function createUserMessage(text: string): MastraDBMessage {
  return {
    id: 'msg-1',
    role: 'user',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  } as unknown as MastraDBMessage;
}

function createSession({
  threadId = 'thread-1',
  title = '',
  firstUserMessage = createUserMessage('Fix the login redirect loop'),
}: {
  threadId?: string | null;
  title?: string;
  firstUserMessage?: MastraDBMessage | null;
} = {}) {
  let currentTitle = title;
  const listeners: Array<(event: AgentControllerEvent) => void> = [];
  const session: ThreadTitleSession = {
    thread: {
      getId: () => threadId,
      getById: vi.fn(async () =>
        threadId === null ? null : { id: threadId, resourceId: 'resource-1', title: currentTitle },
      ),
      firstUserMessage: vi.fn(async () => firstUserMessage),
      rename: vi.fn(async ({ title: next }: { title: string }) => {
        currentTitle = next;
      }),
    },
    subscribe: listener => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };
  const emit = (event: AgentControllerEvent) => {
    for (const listener of [...listeners]) listener(event);
  };
  return { session, emit, thread: session.thread };
}

describe('observeSessionThreadTitle', () => {
  it('renames an untitled thread after the first agent_start', async () => {
    const { session, emit, thread } = createSession();
    const generateTitle = vi.fn().mockResolvedValue('Login redirect fix');
    observeSessionThreadTitle(session, { generateTitle });

    emit({ type: 'agent_start' });
    await vi.waitFor(() => expect(thread.rename).toHaveBeenCalledWith({ title: 'Login redirect fix' }));

    expect(generateTitle).toHaveBeenCalledWith('Fix the login redirect loop');
  });

  it('leaves threads that already carry a title alone', async () => {
    const { session, emit, thread } = createSession({ title: 'Issue #12: Login loop' });
    const generateTitle = vi.fn();
    observeSessionThreadTitle(session, { generateTitle });

    emit({ type: 'agent_start' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(generateTitle).not.toHaveBeenCalled();
    expect(thread.firstUserMessage).not.toHaveBeenCalled();
    expect(thread.rename).not.toHaveBeenCalled();
  });

  it('keeps a title the user set while generation was in flight', async () => {
    const { session, emit, thread } = createSession();
    const generateTitle = vi.fn(async () => {
      (thread.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'My own name',
      });
      return 'Login redirect fix';
    });
    observeSessionThreadTitle(session, { generateTitle });

    emit({ type: 'agent_start' });
    await vi.waitFor(() => expect(thread.getById).toHaveBeenCalledTimes(2));
    expect(thread.rename).not.toHaveBeenCalled();
  });

  it('runs at most once per session and unsubscribes', async () => {
    const { session, emit, thread } = createSession();
    const generateTitle = vi.fn().mockResolvedValue('A title');
    const unsubscribe = observeSessionThreadTitle(session, { generateTitle });

    unsubscribe();
    emit({ type: 'agent_start' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(generateTitle).not.toHaveBeenCalled();

    const { session: liveSession, emit: liveEmit, thread: liveThread } = createSession();
    observeSessionThreadTitle(liveSession, { generateTitle });
    liveEmit({ type: 'message_start' } as AgentControllerEvent);
    liveEmit({ type: 'agent_start' });
    liveEmit({ type: 'agent_start' });
    await vi.waitFor(() => expect(liveThread.rename).toHaveBeenCalled());
    expect(generateTitle).toHaveBeenCalledTimes(1);
  });

  it('skips sessions without a bound thread or without a user prompt', async () => {
    const unbound = createSession({ threadId: null });
    const generateTitleUnbound = vi.fn();
    observeSessionThreadTitle(unbound.session, { generateTitle: generateTitleUnbound });
    unbound.emit({ type: 'agent_start' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(generateTitleUnbound).not.toHaveBeenCalled();

    const promptless = createSession({ firstUserMessage: createUserMessage('') });
    const generateTitlePromptless = vi.fn();
    observeSessionThreadTitle(promptless.session, { generateTitle: generateTitlePromptless });
    promptless.emit({ type: 'agent_start' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(promptless.thread.rename).not.toHaveBeenCalled();
  });

  it('warns instead of throwing when generation fails', async () => {
    const { session, emit, thread } = createSession();
    const generateTitle = vi.fn().mockRejectedValue(new Error('provider down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    observeSessionThreadTitle(session, { generateTitle });

    emit({ type: 'agent_start' });
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith('[Factory thread-title] Unable to generate a thread title.', expect.any(Error)),
    );
    warn.mockRestore();
    expect(thread.rename).not.toHaveBeenCalled();
  });
});

describe('createThreadTitleGenerator', () => {
  it('passes the configured model through to the SDK generator', async () => {
    const generate = createThreadTitleGenerator({ model: 'google/gemini-2.5-flash', thinkingLevel: 'low' });

    await generate('prompt');

    expect(generateThreadTitleMock).toHaveBeenCalledWith({
      prompt: 'prompt',
      model: 'google/gemini-2.5-flash',
      thinkingLevel: 'low',
    });
  });
});
